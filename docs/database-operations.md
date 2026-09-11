# HyperLocal Mission Platform — 데이터베이스 운영 전략

## 문서 정보
| 항목 | 내용 |
|------|------|
| 버전 | v1.0 |
| 작성자 | Senior DBA |
| 대상 DB | PostgreSQL 16.x |
| 환경 | AWS RDS / Aurora PostgreSQL |

---

## 0. 플랫폼 데이터 흐름 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    3자 구조 데이터 흐름                        │
│                                                              │
│  [고객사(소상공인)]                                            │
│       │ 미션 등록 / 예산 충전                                  │
│       ▼                                                      │
│  [운영자] ──── 미션 검수 ────► [missions 테이블]               │
│       │                            │                         │
│       │                     미션 공개/매칭                     │
│       │                            │                         │
│       ▼                            ▼                         │
│  [참여자] ◄──── 매칭 ─────── [mission_applications]           │
│       │                                                      │
│       │ 인증 콘텐츠 업로드                                     │
│       ▼                                                      │
│  [submissions] ──► [운영자 검수] ──► [rewards/settlements]    │
│                                                              │
│  읽기 Heavy: 미션 목록, 참여자 대시보드                         │
│  쓰기 Heavy: 인증 제출, 정산 처리, 이벤트 로그                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 인덱스 최적화 전략

### 1.1 핵심 테이블 스키마 및 인덱스 설계

```sql
-- ============================================================
-- 핵심 테이블: missions (미션 목록 — 읽기 최다 발생)
-- ============================================================
CREATE TABLE missions (
    id              BIGSERIAL PRIMARY KEY,
    client_id       BIGINT        NOT NULL REFERENCES clients(id),
    operator_id     BIGINT        REFERENCES operators(id),
    title           VARCHAR(200)  NOT NULL,
    description     TEXT,
    region_code     VARCHAR(20)   NOT NULL,  -- 'SEOUL_GANGNAM', 'BUSAN_HAEUNDAE'
    category        VARCHAR(50)   NOT NULL,  -- 'SNS_POST', 'VISIT_REVIEW', 'VIDEO'
    status          VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
                    -- DRAFT | PENDING_REVIEW | ACTIVE | CLOSED | CANCELLED
    reward_amount   NUMERIC(12,2) NOT NULL,
    max_participants INT          NOT NULL DEFAULT 10,
    current_count   INT          NOT NULL DEFAULT 0,
    starts_at       TIMESTAMPTZ  NOT NULL,
    ends_at         TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,            -- Soft Delete
    
    CONSTRAINT chk_reward_positive   CHECK (reward_amount > 0),
    CONSTRAINT chk_count_valid       CHECK (current_count <= max_participants),
    CONSTRAINT chk_period_valid      CHECK (ends_at > starts_at)
);

-- ──────────────────────────────────────────────────────────
-- 인덱스 전략: 쿼리 패턴별 분류
-- ──────────────────────────────────────────────────────────

-- [패턴 1] 참여자 미션 탐색 — 가장 빈번한 쿼리
-- SELECT * FROM missions WHERE region_code = ? AND status = 'ACTIVE'
--   AND ends_at > NOW() ORDER BY created_at DESC LIMIT 20;
CREATE INDEX idx_missions_region_status_active
    ON missions (region_code, status, ends_at DESC)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;
-- → 부분 인덱스(Partial Index): ACTIVE 상태만 인덱싱, 크기 70% 절감

-- [패턴 2] 운영자 검수 대기 목록
-- SELECT * FROM missions WHERE status = 'PENDING_REVIEW' ORDER BY created_at;
CREATE INDEX idx_missions_pending_review
    ON missions (created_at ASC)
    WHERE status = 'PENDING_REVIEW';

-- [패턴 3] 고객사 대시보드 — 자사 미션 조회
-- SELECT * FROM missions WHERE client_id = ? ORDER BY created_at DESC;
CREATE INDEX idx_missions_client_created
    ON missions (client_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- [패턴 4] 만료 임박 미션 배치 처리
-- SELECT id FROM missions WHERE ends_at BETWEEN NOW() AND NOW() + INTERVAL '1 day';
CREATE INDEX idx_missions_ends_at
    ON missions (ends_at)
    WHERE status = 'ACTIVE';

-- [패턴 5] 카테고리 + 지역 복합 필터
CREATE INDEX idx_missions_category_region
    ON missions (category, region_code, status)
    WHERE deleted_at IS NULL;
```

```sql
-- ============================================================
-- 핵심 테이블: submissions (인증 제출 — 쓰기/검수 Heavy)
-- ============================================================
CREATE TABLE submissions (
    id              BIGSERIAL PRIMARY KEY,
    mission_id      BIGINT        NOT NULL REFERENCES missions(id),
    participant_id  BIGINT        NOT NULL REFERENCES participants(id),
    content_url     TEXT          NOT NULL,
    platform        VARCHAR(30),  -- 'INSTAGRAM', 'BLOG', 'TIKTOK'
    status          VARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED',
                    -- SUBMITTED | REVIEWING | APPROVED | REJECTED | PAID
    review_note     TEXT,
    reviewer_id     BIGINT        REFERENCES operators(id),
    reviewed_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_submission_once
        UNIQUE (mission_id, participant_id)  -- 동일 미션 중복 제출 방지
);

-- [패턴 1] 운영자 검수 큐 — 핵심 운영 쿼리
-- SELECT * FROM submissions WHERE status = 'SUBMITTED' ORDER BY submitted_at;
CREATE INDEX idx_submissions_review_queue
    ON submissions (submitted_at ASC)
    WHERE status = 'SUBMITTED';

-- [패턴 2] 미션별 제출 현황 집계
-- SELECT COUNT(*), status FROM submissions WHERE mission_id = ? GROUP BY status;
CREATE INDEX idx_submissions_mission_status
    ON submissions (mission_id, status);

-- [패턴 3] 참여자 제출 이력
-- SELECT * FROM submissions WHERE participant_id = ? ORDER BY created_at DESC;
CREATE INDEX idx_submissions_participant
    ON submissions (participant_id, created_at DESC);

-- [패턴 4] 승인 완료 → 정산 배치 처리
-- SELECT * FROM submissions WHERE status = 'APPROVED' AND reviewed_at < NOW() - INTERVAL '1 day';
CREATE INDEX idx_submissions_approved_settlement
    ON submissions (reviewed_at)
    WHERE status = 'APPROVED';

-- [패턴 5] 플랫폼별 통계 (운영자 분석)
CREATE INDEX idx_submissions_platform_status
    ON submissions (platform, status)
    WHERE status IN ('APPROVED', 'REJECTED');
```

```sql
-- ============================================================
-- 핵심 테이블: settlements (정산 — 정확성 최우선)
-- ============================================================
CREATE TABLE settlements (
    id              BIGSERIAL PRIMARY KEY,
    submission_id   BIGINT        NOT NULL REFERENCES submissions(id),
    participant_id  BIGINT        NOT NULL REFERENCES participants(id),
    gross_amount    NUMERIC(12,2) NOT NULL,  -- 지급 총액
    fee_rate        NUMERIC(5,4)  NOT NULL,  -- 플랫폼 수수료율 (예: 0.1500 = 15%)
    fee_amount      NUMERIC(12,2) NOT NULL,  -- 수수료 = gross * fee_rate
    net_amount      NUMERIC(12,2) NOT NULL,  -- 실지급액 = gross - fee
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
                    -- PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED
    payment_method  VARCHAR(30),  -- 'BANK_TRANSFER', 'POINT'
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    batch_id        UUID,                    -- 배치 정산 그룹 식별자
    
    CONSTRAINT uq_settlement_submission UNIQUE (submission_id),
    CONSTRAINT chk_net_amount CHECK (net_amount = gross_amount - fee_amount),
    CONSTRAINT chk_fee_amount CHECK (fee_amount = ROUND(gross_amount * fee_rate, 2))
);

-- [패턴 1] 정산 배치 처리 현황
CREATE INDEX idx_settlements_batch_status
    ON settlements (batch_id, status)
    WHERE batch_id IS NOT NULL;

-- [패턴 2] 참여자 정산 내역 조회
CREATE INDEX idx_settlements_participant_paid
    ON settlements (participant_id, paid_at DESC)
    WHERE status = 'COMPLETED';

-- [패턴 3] 미정산 건 모니터링
CREATE INDEX idx_settlements_pending
    ON settlements (created_at ASC)
    WHERE status = 'PENDING';
```

### 1.2 인덱스 유효성 모니터링 쿼리

```sql
-- ──────────────────────────────────────────────────────────
-- 사용되지 않는 인덱스 탐지 (매월 검토)
-- ──────────────────────────────────────────────────────────
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan        AS "스캔 횟수",
    idx_tup_read    AS "읽은 튜플",
    idx_tup_fetch   AS "가져온 튜플",
    pg_size_pretty(pg_relation_size(indexrelid)) AS "인덱스 크기"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- ──────────────────────────────────────────────────────────
-- 인덱스 팽창(Bloat) 탐지
-- ──────────────────────────────────────────────────────────
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid))       AS "현재 크기",
    pg_size_pretty(pg_relation_size(indexrelid) * 0.7) AS "예상 정상 크기",
    round(
        100 * (1 - pg_stat_user_indexes.idx_tup_read::numeric
        / NULLIF(pg_stat_user_indexes.idx_tup_fetch, 0))
    ) AS "팽창 추정(%)"
FROM pg_stat_user_indexes
JOIN pg_indexes USING (indexname)
WHERE schemaname = 'public'
  AND pg_relation_size(indexrelid) > 10 * 1024 * 1024  -- 10MB 이상만
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 2. 파티셔닝 전략

### 2.1 파티셔닝 대상 선정 기준

```
┌─────────────────────────────────────────────────────────────┐
│              파티셔닝 대상 우선순위 결정 매트릭스               │
│                                                              │
│  테이블명            월 예상 레코드   파티셔닝 필요성            │
│  ─────────────────────────────────────────────────────────  │
│  submissions         30,000건        ★★★★★ (핵심 대상)       │
│  mission_events      200,000건       ★★★★★ (로그성 데이터)    │
│  settlements         30,000건        ★★★★☆                  │
│  notifications       150,000건       ★★★★☆                  │
│  missions            500건           ★★☆☆☆ (현재 불필요)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 submissions 테이블 — 월별 범위 파티셔닝

```sql
-- ============================================================
-- submissions 파티션 테이블 설계
-- 전략: RANGE 파티셔닝 (created_at 기준, 월별)
-- 이유: 검수/정산은 최근 데이터 중심, 과거 데이터는 아카이빙 가능
-- ============================================================

-- 1단계: 부모 테이블 생성
CREATE TABLE submissions (
    id              BIGSERIAL,
    mission_id      BIGINT        NOT NULL,
    participant_id  BIGINT        NOT NULL,
    content_url     TEXT          NOT NULL,
    platform        VARCHAR(30),
    status          VARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED',
    review_note     TEXT,
    reviewer_id     BIGINT,
    reviewed_at     TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)  -- 파티션 키 반드시 PK에 포함
) PARTITION BY RANGE (created_at);

-- 2단계: 월별 파티션 생성 (자동화 권장)
CREATE TABLE submissions_2025_01
    PARTITION OF submissions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE submissions_2025_02
    PARTITION OF submissions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... 월별 자동 생성 함수
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_year       INT,
    p_month      INT
) RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date     DATE;
    v_end_date       DATE;
    v_index_name     TEXT;
BEGIN
    v_partition_name := FORMAT('%s_%s_%s',
        p_table_name,
        p_year,
        LPAD(p_month::TEXT, 2, '0')
    );
    v_start_date := DATE(FORMAT('%s-%s-01', p_year, p_month));
    v_end_date   := v_start_date + INTERVAL '1 month';
    
    -- 파티션 생성
    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS %I
         PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        v_partition_name, p_table_name,
        v_start_date, v_end_date
    );
    
    -- 파티션별 로컬 인덱스 생성 (검수 큐 패턴)
    v_index_name := FORMAT('idx_%s_review_queue', v_partition_name);
    EXECUTE FORMAT(
        'CREATE INDEX IF NOT EXISTS %I
         ON %I (submitted_at ASC)
         WHERE status = ''SUBMITTED''',
        v_index_name, v_partition_name
    );
    
    RAISE NOTICE '파티션 생성 완료: % (% ~ %)',
        v_partition_name, v_start_date, v_end_date;
END;
$$ LANGUAGE plpgsql;

-- 3단계: 파티션 자동 생성 스케줄러 (pg_cron 활용)
-- 매월 25일 다음 달 파티션 선생성
SELECT cron.schedule(
    'create-next-month-partition',
    '0 1 25 * *',  -- 매월 25일 01:00
    $$
    SELECT create_monthly_partition(
        'submissions',
        EXTRACT(YEAR  FROM NOW() + INTERVAL '1 month')::INT,
        EXTRACT(MONTH FROM NOW() + INTERVAL '1 month')::INT
    );
    $$
);
```

### 2.3 mission_events 테이블 — 이벤트 로그 파티셔닝

```sql
-- ============================================================
-- mission_events: 활동 로그 (고빈도 INSERT, 집계 쿼리)
-- 전략: LIST 파티셔닝 (event_type 기준) + 서브 파티셔닝 (월별)
-- ============================================================

CREATE TABLE mission_events (
    id              BIGSERIAL,
    mission_id      BIGINT       NOT NULL,
    actor_id        BIGINT       NOT NULL,
    actor_type      VARCHAR(20)  NOT NULL,  -- 'OPERATOR', 'PARTICIPANT', 'CLIENT'
    event_type      VARCHAR(50)  NOT NULL,
                    -- 'MISSION_CREATED', 'MISSION_APPROVED', 'SUBMISSION_RECEIVED'
                    -- 'REVIEW_STARTED', 'REVIEW_COMPLETED', 'PAYMENT_PROCESSED'
    payload         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 파티션별 JSONB 인덱스 (payload 검색용)
-- 특정 파티션에만 필요한 경우 선택적 생성
CREATE INDEX idx_events_payload_mission
    ON mission_events USING GIN (payload jsonb_path_ops)
    WHERE event_type LIKE 'MISSION_%';

-- 오래된 파티션 아카이빙 함수
CREATE OR REPLACE FUNCTION archive_old_partition(
    p_table_name    TEXT,
    p_months_old    INT DEFAULT 6
) RETURNS VOID AS $$
DECLARE
    v_archive_name TEXT;
    v_partition    RECORD;
BEGIN
    FOR v_partition IN
        SELECT inhrelid::regclass AS partition_name
        FROM pg_inherits
        JOIN pg_class ON inhrelid = pg_class.oid
        WHERE inhparent = p_table_name::regclass
    LOOP
        -- 6개월 이상 된 파티션 감지 로직
        -- 실제 운영에서는 파티션명 기반 날짜 파싱 후 비교
        RAISE NOTICE '아카이빙 검토: %', v_partition.partition_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 파티션 프루닝 확인

```sql
-- ──────────────────────────────────────────────────────────
-- 파티션 프루닝이 올바르게 작동하는지 확인
-- ──────────────────────────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*)
FROM submissions
WHERE created_at >= '2025-01-01'
  AND created_at <  '2025-02-01'
  AND status = 'SUBMITTED';
-- → "Seq Scan on submissions_2025_01" 만 표시되어야 정상

-- 파티션 목록 및 크기 확인
SELECT
    child.relname                                    AS "파티션명",
    pg_size_pretty(pg_relation_size(child.oid))      AS "크기",
    pg_size_pretty(pg_total_relation_size(child.oid)) AS "인덱스 포함 크기",
    to_char(
        (regexp_match(child.relname, '(\d{4})_(\d{2})$'))[1]::INT,
        '9999'
    ) || '년 ' ||
    (regexp_match(child.relname, '(\d{4})_(\d{2})$'))[2] || '월' AS "기간"
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'submissions'
ORDER BY child.relname;
```

---

## 3. 백업 및 복구 절차

### 3.1 백업 전략 — 3-2-1 원칙 적용

```
┌─────────────────────────────────────────────────────────────┐
│                    백업 계층 구조 (3-2-1 원칙)                 │
│                                                              │
│  3개 복사본                                                   │
│  ├── 원본: RDS Primary (ap-northeast-2, 서울)                 │
│  ├── 복사본1: RDS Automated Backup (동일 리전, S3)             │
│  └── 복사본2: Cross-Region Backup (ap-northeast-1, 도쿄)      │
│                                                              │
│  2가지 미디어                                                  │
│  ├── RDS 스냅샷 (EBS)                                         │
│  └── pg_dump (S3 Glacier)                                    │
│                                                              │
│  1개 오프사이트                                                │
│  └── 도쿄 리전 S3 Cross-Region Replication                    │
│                                                              │
│  RPO 목표: 1시간 이내 (정산 데이터 손실 최소화)                  │
│  RTO 목표: 30분 이내 (비즈니스 영향 최소화)                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 백업 스크립트 구현

```bash
#!/bin/bash
# ============================================================
# 파일명: backup_hyperlocal.sh
# 목적:  HyperLocal DB 일일 백업 자동화
# 스케줄: 매일 02:00 KST (crontab: 0 17 * * * /scripts/backup_hyperlocal.sh)
# ============================================================

set -euo pipefail

# ── 환경 변수 ──────────────────────────────────────────────
DB_HOST="${DB_HOST:-hyperlocal-db.cluster-xxx.ap-northeast-2.rds.amazonaws.com}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-hyperlocal_prod}"
DB_USER="${DB_USER:-backup_user}"
S3_BUCKET="${S3_BUCKET:-s3://hyperlocal-db-backups}"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/hyperlocal_${TIMESTAMP}.dump"
LOG_FILE="/var/log/db_backup/backup_${TIMESTAMP}.log"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# ── 로깅 함수 ─────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

notify_slack() {
    local status=$1
    local message=$2
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"[DB Backup] ${status}: ${message}\"}"
    fi
}

# ── 사전 점검 ─────────────────────────────────────────────
preflight_check() {
    log "=== 백업 사전 점검 시작 ==="
    
    # 디스크 여유 공간 확인 (최소 10GB)
    local free_space
    free_space=$(df /tmp --output=avail -k | tail -1)
    if [[ $free_space -lt 10485760 ]]; then
        log "ERROR: 디스크 여유 공간 부족 (${free_space}KB)"
        notify_slack "❌ FAILED" "디스크 여유 공간 부족"
        exit 1
    fi
    
    # DB 연결 확인
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        log "ERROR: DB 연결 실패"
        notify_slack "❌ FAILED" "DB 연결 실패 - ${DB_HOST}"
        exit 1
    fi
    
    log "사전 점검 완료 ✓"
}

# ── 전체 백업 (pg_dump Custom Format) ─────────────────────
full_backup() {
    log "=== 전체 백업 시작: ${BACKUP_FILE} ==="
    
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --format=custom \          # 병렬 복구 가능한 Custom Format
        --compress=9 \             # 최대 압축 (백업 크기 60~70% 절감)
        --jobs=4 \                 # 병렬 덤프
        --no-privileges \
        --no-owner \
        --file="$BACKUP_FILE" \
        --verbose 2>> "$LOG_FILE"
    
    local backup_size
    backup_size=$(du -sh "$BACKUP_FILE" | cut -f1)
    log "백업 파일 생성 완료: ${backup_size}"
}

# ── 정산 테이블 별도 백업 (무결성 최우선) ─────────────────
critical_tables_backup() {
    log "=== 정산 테이블 별도 백업 시작 ==="
    local critical_file="/tmp/hyperlocal_critical_${TIMESTAMP}.sql"
    
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --format=plain \
        --table=settlements \
        --table=submissions \
        --table=missions \
        --inserts \                # INSERT 구문으로 출력 (이식성)
        --file="$critical_file" 2>> "$LOG_FILE"
    
    # 별도 경로에 암호화하여 저장
    gpg --symmetric --cipher-algo AES256 \
        --batch --passphrase "${GPG_PASSPHRASE}" \
        "$critical_file"
    rm -f "$critical_file"
    
    aws s3 cp "${critical_file}.gpg" \
        "${S3_BUCKET}/critical/hyperlocal_critical_${TIMESTAMP}.sql.gpg" \
        --storage-class GLACIER_IR
    
    log "정산 테이블 암호화 백업 완료 ✓"
}

# ── S3 업로드 및 검증 ─────────────────────────────────────
upload_and_verify() {
    log "=== S3 업로드 시작 ==="
    
    # 체크섬 생성
    local checksum
    checksum=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
    echo "$checksum" > "${BACKUP_FILE}.sha256"
    
    # S3 업로드 (멀티파트, 서버사이드 암호화)
    aws s3 cp "$BACKUP_FILE" \
        "${S3_BUCKET}/full/hyperlocal_${TIMESTAMP}.dump" \
        --sse aws:kms \
        --sse-kms-key-id "${KMS_KEY_ID}" \
        --storage-class STANDARD_IA \
        --metadata "checksum=${checksum},timestamp=${TIMESTAMP}"
    
    aws s3 cp "${BACKUP_FILE}.sha256" \
        "${S3_BUCKET}/full/hyperlocal_${TIMESTAMP}.dump.sha256"
    
    # 업로드 검증
    local uploaded_size
    uploaded_size=$(aws s3 ls "${S3_BUCKET}/full/hyperlocal_${TIMESTAMP}.dump" \
        | awk '{print $3}')
    local local_size
    local_size=$(wc -c < "$BACKUP_FILE")
    
    if [[ "$uploaded_size" != "$local_size" ]]; then
        log "ERROR: 업로드 크기 불일치 (local: ${local_size}, S3: ${uploaded_size})"
        exit 1
    fi
    
    log "S3 업로드 및 검증 완료 ✓ (체크섬: ${checksum:0:16}...)"
}

# ── 오래된 백업 정리 ──────────────────────────────────────
cleanup_old_backups() {
    log "=== 30일 이상 된 백업 정리 ==="
    aws s3 ls "${S3_BUCKET}/full/" | while read -r line; do