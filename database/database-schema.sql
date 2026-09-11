# HyperLocal Mission Platform — 완전한 데이터베이스 스키마 설계

## 1. 엔티티-관계 다이어그램 (Mermaid ERD)

```mermaid
erDiagram
    %% =====================================================
    %% CORE USER DOMAIN
    %% =====================================================
    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        user_role role
        varchar name
        varchar phone
        boolean is_active
        boolean is_email_verified
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    participant_profiles {
        uuid id PK
        uuid user_id UK FK
        varchar nickname
        text bio
        varchar activity_region
        varchar city
        varchar district
        decimal latitude
        decimal longitude
        integer total_earned_points
        integer available_points
        integer completed_mission_count
        decimal rating_average
        timestamptz created_at
        timestamptz updated_at
    }

    client_profiles {
        uuid id PK
        uuid user_id UK FK
        varchar business_name
        varchar business_number UK
        varchar representative_name
        varchar business_category
        varchar address
        varchar city
        varchar district
        decimal latitude
        decimal longitude
        varchar phone
        varchar website_url
        text description
        varchar logo_url
        boolean is_verified
        timestamptz verified_at
        timestamptz created_at
        timestamptz updated_at
    }

    sns_channels {
        uuid id PK
        uuid participant_profile_id FK
        sns_platform platform
        varchar handle
        varchar profile_url
        integer follower_count
        boolean is_verified
        timestamptz verified_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    %% =====================================================
    %% MISSION DOMAIN
    %% =====================================================
    missions {
        uuid id PK
        uuid client_profile_id FK
        uuid created_by_operator_id FK
        varchar title
        text description
        mission_category category
        mission_status status
        varchar region
        varchar city
        varchar district
        decimal latitude
        decimal longitude
        integer reward_points
        integer max_participants
        integer current_participants
        integer approved_submissions
        date start_date
        date end_date
        text requirements
        text caution
        jsonb sns_requirements
        integer min_follower_count
        varchar thumbnail_url
        boolean is_featured
        timestamptz published_at
        timestamptz closed_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    mission_tags {
        uuid id PK
        uuid mission_id FK
        varchar tag
        timestamptz created_at
    }

    %% =====================================================
    %% APPLICATION & SUBMISSION DOMAIN
    %% =====================================================
    applications {
        uuid id PK
        uuid mission_id FK
        uuid participant_profile_id FK
        application_status status
        text motivation
        text operator_note
        timestamptz applied_at
        timestamptz approved_at
        timestamptz rejected_at
        timestamptz created_at
        timestamptz updated_at
    }

    submissions {
        uuid id PK
        uuid application_id UK FK
        uuid mission_id FK
        uuid participant_profile_id FK
        submission_status status
        text content_description
        varchar content_url
        varchar sns_post_url
        jsonb media_urls
        text rejection_reason
        text operator_feedback
        uuid reviewed_by_operator_id FK
        integer review_round
        timestamptz submitted_at
        timestamptz reviewed_at
        timestamptz approved_at
        timestamptz created_at
        timestamptz updated_at
    }

    submission_histories {
        uuid id PK
        uuid submission_id FK
        submission_status from_status
        submission_status to_status
        uuid changed_by_id FK
        text reason
        timestamptz changed_at
    }

    %% =====================================================
    %% REWARD & SETTLEMENT DOMAIN
    %% =====================================================
    point_ledgers {
        uuid id PK
        uuid participant_profile_id FK
        point_transaction_type transaction_type
        integer amount
        integer balance_after
        varchar reference_type
        uuid reference_id
        text description
        timestamptz created_at
    }

    settlements {
        uuid id PK
        uuid participant_profile_id FK
        settlement_status status
        integer total_points
        integer fee_points
        integer net_points
        decimal exchange_rate
        decimal net_amount_krw
        varchar bank_name
        varchar account_number
        varchar account_holder
        uuid processed_by_operator_id FK
        text reject_reason
        timestamptz requested_at
        timestamptz processed_at
        timestamptz created_at
        timestamptz updated_at
    }

    %% =====================================================
    %% NOTIFICATION DOMAIN
    %% =====================================================
    notifications {
        uuid id PK
        uuid user_id FK
        notification_type type
        varchar title
        text body
        jsonb metadata
        boolean is_read
        timestamptz read_at
        timestamptz created_at
    }

    %% =====================================================
    %% AUDIT DOMAIN
    %% =====================================================
    audit_logs {
        uuid id PK
        uuid actor_id FK
        varchar action
        varchar target_table
        uuid target_id
        jsonb before_data
        jsonb after_data
        varchar ip_address
        varchar user_agent
        timestamptz created_at
    }

    %% =====================================================
    %% RELATIONSHIPS
    %% =====================================================
    users ||--o| participant_profiles : "has"
    users ||--o| client_profiles : "has"
    participant_profiles ||--o{ sns_channels : "owns"
    client_profiles ||--o{ missions : "requests"
    users ||--o{ missions : "created_by(operator)"
    missions ||--o{ mission_tags : "has"
    missions ||--o{ applications : "receives"
    participant_profiles ||--o{ applications : "submits"
    applications ||--o| submissions : "produces"
    missions ||--o{ submissions : "collects"
    participant_profiles ||--o{ submissions : "creates"
    users ||--o{ submissions : "reviews(operator)"
    submissions ||--o{ submission_histories : "tracks"
    users ||--o{ submission_histories : "changes"
    participant_profiles ||--o{ point_ledgers : "records"
    participant_profiles ||--o{ settlements : "requests"
    users ||--o{ settlements : "processes(operator)"
    users ||--o{ notifications : "receives"
    users ||--o{ audit_logs : "generates"
```

---

## 2. Enum 타입 정의 (DDL)

```sql
-- ================================================================
-- FILE: 001_create_enums.sql
-- 모든 Enum 타입을 먼저 정의 (DDL 의존성 순서 준수)
-- ================================================================

-- 사용자 역할 (RBAC 미들웨어와 1:1 매핑)
CREATE TYPE user_role AS ENUM (
    'OPERATOR',       -- 운영자 (내부 스태프)
    'PARTICIPANT',    -- 참여자 (지역 주민)
    'CLIENT'          -- 고객사 (소상공인)
);

-- SNS 플랫폼 종류
CREATE TYPE sns_platform AS ENUM (
    'INSTAGRAM',
    'YOUTUBE',
    'TIKTOK',
    'NAVER_BLOG',
    'KAKAO_STORY',
    'TWITTER'
);

-- 미션 카테고리
CREATE TYPE mission_category AS ENUM (
    'VISIT',          -- 방문 인증
    'SNS',            -- SNS 게시물
    'REVIEW',         -- 텍스트 리뷰
    'VIDEO'           -- 영상 콘텐츠
);

-- 미션 진행 상태 (단방향 전이: draft→open→in_progress→reviewing→closed)
CREATE TYPE mission_status AS ENUM (
    'DRAFT',
    'OPEN',
    'IN_PROGRESS',
    'REVIEWING',
    'CLOSED'
);

-- 지원서 상태
CREATE TYPE application_status AS ENUM (
    'PENDING',        -- 검토 대기
    'APPROVED',       -- 승인됨
    'REJECTED',       -- 거절됨
    'WITHDRAWN',      -- 참여자 자진 철회
    'COMPLETED'       -- 미션 완료 확정
);

-- 제출물 상태
CREATE TYPE submission_status AS ENUM (
    'DRAFT',          -- 임시 저장
    'SUBMITTED',      -- 제출 완료 (검수 대기)
    'UNDER_REVIEW',   -- 검수 중
    'APPROVED',       -- 승인 완료
    'REJECTED',       -- 반려 (재제출 가능)
    'FINAL_REJECTED'  -- 최종 반려 (재제출 불가)
);

-- 포인트 트랜잭션 타입
CREATE TYPE point_transaction_type AS ENUM (
    'EARN_SUBMISSION',     -- 제출 승인 획득
    'DEDUCT_SETTLEMENT',   -- 정산 차감
    'DEDUCT_PENALTY',      -- 패널티 차감
    'ADJUST_MANUAL',       -- 운영자 수동 조정
    'REFUND'               -- 환불
);

-- 정산 상태
CREATE TYPE settlement_status AS ENUM (
    'REQUESTED',      -- 정산 신청
    'PROCESSING',     -- 처리 중
    'COMPLETED',      -- 정산 완료
    'REJECTED'        -- 정산 거절
);

-- 알림 타입
CREATE TYPE notification_type AS ENUM (
    'MISSION_OPEN',           -- 신규 미션 오픈
    'APPLICATION_APPROVED',   -- 지원 승인
    'APPLICATION_REJECTED',   -- 지원 거절
    'SUBMISSION_APPROVED',    -- 제출 승인
    'SUBMISSION_REJECTED',    -- 제출 반려
    'POINT_EARNED',           -- 포인트 적립
    'SETTLEMENT_COMPLETED',   -- 정산 완료
    'SETTLEMENT_REJECTED',    -- 정산 거절
    'SYSTEM'                  -- 시스템 공지
);
```

---

## 3. 핵심 테이블 DDL

### 3-1. 사용자 도메인

```sql
-- ================================================================
-- FILE: 002_create_users.sql
-- ================================================================

-- Extension 활성화 (init.sql 또는 최상단 1회 실행)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- LIKE 검색 최적화
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- 복합 GIN 인덱스

-- ----------------------------------------------------------------
-- TABLE: users (통합 사용자 계정 — 모든 역할 공유)
-- ----------------------------------------------------------------
CREATE TABLE users (
    id                  UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    email               VARCHAR(255)    NOT NULL,
    password_hash       VARCHAR(255)    NOT NULL,           -- bcrypt hash (cost=12)
    role                user_role       NOT NULL,
    name                VARCHAR(100)    NOT NULL,
    phone               VARCHAR(20),                        -- E.164 형식 권장
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_email_verified   BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,                        -- soft delete

    -- 제약 조건
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9\-\s]{8,20}$')
);

-- Unique: 활성 계정 기준 이메일 중복 방지 (소프트 딜리트 고려)
CREATE UNIQUE INDEX uq_users_email_active
    ON users (email)
    WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------
-- TABLE: participant_profiles (참여자 확장 프로필)
-- ----------------------------------------------------------------
CREATE TABLE participant_profiles (
    id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                     UUID        NOT NULL,
    nickname                    VARCHAR(50) NOT NULL,
    bio                         TEXT,
    activity_region             VARCHAR(100),               -- 자유 입력 텍스트
    city                        VARCHAR(50),                -- 시/도
    district                    VARCHAR(50),                -- 구/군
    latitude                    DECIMAL(10, 7),             -- WGS84 위도
    longitude                   DECIMAL(10, 7),             -- WGS84 경도
    total_earned_points         INTEGER     NOT NULL DEFAULT 0,
    available_points            INTEGER     NOT NULL DEFAULT 0,
    completed_mission_count     INTEGER     NOT NULL DEFAULT 0,
    rating_average              DECIMAL(3, 2),              -- 0.00 ~ 5.00
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 제약 조건
    CONSTRAINT fk_participant_profiles_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_participant_profiles_user
        UNIQUE (user_id),
    CONSTRAINT uq_participant_profiles_nickname
        UNIQUE (nickname),
    CONSTRAINT chk_participant_points_non_negative
        CHECK (total_earned_points >= 0 AND available_points >= 0),
    CONSTRAINT chk_participant_available_lte_total
        CHECK (available_points <= total_earned_points),
    CONSTRAINT chk_participant_rating_range
        CHECK (rating_average IS NULL OR (rating_average >= 0 AND rating_average <= 5)),
    CONSTRAINT chk_participant_coordinates
        CHECK (
            (latitude IS NULL AND longitude IS NULL) OR
            (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
        )
);

-- ----------------------------------------------------------------
-- TABLE: client_profiles (고객사 확장 프로필)
-- ----------------------------------------------------------------
CREATE TABLE client_profiles (
    id                      UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID            NOT NULL,
    business_name           VARCHAR(100)    NOT NULL,
    business_number         VARCHAR(20)     NOT NULL,   -- 사업자등록번호
    representative_name     VARCHAR(50)     NOT NULL,
    business_category       VARCHAR(50),                -- 업종 (카페, 음식점 등)
    address                 VARCHAR(255),
    city                    VARCHAR(50),
    district                VARCHAR(50),
    latitude                DECIMAL(10, 7),
    longitude               DECIMAL(10, 7),
    phone                   VARCHAR(20),
    website_url             VARCHAR(500),
    description             TEXT,
    logo_url                VARCHAR(500),
    is_verified             BOOLEAN         NOT NULL DEFAULT FALSE,  -- 사업자 인증 여부
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_client_profiles_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_client_profiles_user
        UNIQUE (user_id),
    CONSTRAINT uq_client_profiles_business_number
        UNIQUE (business_number),
    CONSTRAINT chk_client_coordinates
        CHECK (
            (latitude IS NULL AND longitude IS NULL) OR
            (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
        )
);

-- ----------------------------------------------------------------
-- TABLE: sns_channels (참여자 SNS 채널 목록 — 1:N)
-- ----------------------------------------------------------------
CREATE TABLE sns_channels (
    id                      UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_profile_id  UUID            NOT NULL,
    platform                sns_platform    NOT NULL,
    handle                  VARCHAR(100)    NOT NULL,   -- @계정명
    profile_url             VARCHAR(500),
    follower_count          INTEGER         NOT NULL DEFAULT 0,
    is_verified             BOOLEAN         NOT NULL DEFAULT FALSE,
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT fk_sns_channels_participant
        FOREIGN KEY (participant_profile_id)
        REFERENCES participant_profiles (id) ON DELETE CASCADE,
    -- 동일 참여자가 같은 플랫폼 중복 등록 방지 (활성 채널)
    CONSTRAINT chk_sns_follower_non_negative
        CHECK (follower_count >= 0)
);

-- 동일 참여자 + 플랫폼 조합 유니크 (소프트 딜리트 고려)
CREATE UNIQUE INDEX uq_sns_channels_participant_platform
    ON sns_channels (participant_profile_id, platform)
    WHERE deleted_at IS NULL;
```

### 3-2. 미션 도메인

```sql
-- ================================================================
-- FILE: 003_create_missions.sql
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: missions (미션 마스터)
-- ----------------------------------------------------------------
CREATE TABLE missions (
    id                      UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    client_profile_id       UUID                NOT NULL,
    created_by_operator_id  UUID                NOT NULL,   -- 미션 등록 운영자
    title                   VARCHAR(200)        NOT NULL,
    description             TEXT                NOT NULL,
    category                mission_category    NOT NULL,
    status                  mission_status      NOT NULL DEFAULT 'DRAFT',
    region                  VARCHAR(100),                   -- 미션 수행 지역 (텍스트)
    city                    VARCHAR(50),
    district                VARCHAR(50),
    latitude                DECIMAL(10, 7),
    longitude               DECIMAL(10, 7),
    reward_points           INTEGER             NOT NULL,   -- 승인 시 지급 포인트
    max_participants        INTEGER             NOT NULL,   -- 최대 참여 가능 인원
    current_participants    INTEGER             NOT NULL DEFAULT 0,
    approved_submissions    INTEGER             NOT NULL DEFAULT 0,
    start_date              DATE                NOT NULL,
    end_date                DATE                NOT NULL,
    requirements            TEXT,                           -- 미션 수행 필수 조건
    caution                 TEXT,                           -- 주의사항
    sns_requirements        JSONB,                          -- 플랫폼별 상세 요건
    min_follower_count      INTEGER             DEFAULT 0,  -- 최소 팔로워 수
    thumbnail_url           VARCHAR(500),
    is_featured             BOOLEAN             NOT NULL DEFAULT FALSE,
    published_at            TIMESTAMPTZ,
    closed_at               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT fk_missions_client
        FOREIGN KEY (client_profile_id)
        REFERENCES client_profiles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_missions_operator
        FOREIGN KEY (created_by_operator_id)
        REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_missions_dates
        CHECK (end_date > start_date),
    CONSTRAINT chk_missions_reward_positive
        CHECK (reward_points > 0),
    CONSTRAINT chk_missions_max_participants_positive
        CHECK (max_participants > 0),
    CONSTRAINT chk_missions_current_lte_max
        CHECK (current_participants <= max_participants),
    CONSTRAINT chk_missions_approved_lte_current
        CHECK (approved_submissions <= current_participants),
    CONSTRAINT chk_missions_follower_non_negative
        CHECK (min_follower_count >= 0)
);

-- sns_requirements JSONB 구조 (문서화 주석)
-- {
--   "instagram": { "required": true, "minFollowers": 500 },
--   "youtube":   { "required": false, "minFollowers": 0 }
-- }

COMMENT ON COLUMN missions.sns_requirements IS
    'JSON 구조: {"instagram":{"required":bool,"minFollowers":int}, ...}';

-- ----------------------------------------------------------------
-- TABLE: mission_tags (미션 태그 — 정규화)
-- ----------------------------------------------------------------
CREATE TABLE mission_tags (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id  UUID        NOT NULL,
    tag         VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mission_tags_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id) ON DELETE CASCADE,
    CONSTRAINT uq_mission_tags_unique
        UNIQUE (mission_id, tag)
);
```

### 3-3. 지원서 & 제출물 도메인

```sql
-- ================================================================
-- FILE: 004_create_applications_submissions.sql
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: applications (미션 지원서)
-- ----------------------------------------------------------------
CREATE TABLE applications (
    id                      UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id              UUID                NOT NULL,
    participant_profile_id  UUID                NOT NULL,
    status                  application_status  NOT NULL DEFAULT 'PENDING',
    motivation              TEXT,                           -- 지원 동기 (선택)
    operator_note           TEXT,                           -- 운영자 내부 메모
    applied_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    approved_at             TIMESTAMPTZ,
    rejected_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_applications_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_participant
        FOREIGN KEY (participant_profile_id)
        REFERENCES participant_profiles (id) ON DELETE RESTRICT,
    -- 동일 참여자의 동일 미션 중복 지원 방지
    CONSTRAINT uq_applications_mission_participant
        UNIQUE (mission_id, participant_profile_id)
);

-- ----------------------------------------------------------------
-- TABLE: submissions (미션 제출물 — 인증 콘텐츠)
-- ----------------------------------------------------------------
CREATE TABLE submissions (
    id                          UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id              UUID                NOT NULL,
    mission_id                  UUID                NOT NULL,   -- 조회 편의를 위한 역정규화
    participant_profile_id      UUID                NOT NULL,   -- 조회 편의를 위한 역정규화
    status                      submission_status   NOT NULL DEFAULT 'DRAFT',
    content_description         TEXT,                           -- 콘텐츠 설명
    content_url                 VARCHAR(500),                   -- 원본 콘텐츠 링크
    sns_post_url                VARCHAR(500),                   -- 실제 SNS 게시 URL
    media_urls                  JSONB,                          -- 업로드 이미지/영상 배열
    rejection_reason            TEXT,                           -- 반려 사유 (참여자 공개)
    operator_feedback           TEXT,                           -- 운영자 내부 메모
    reviewed_by_operator_id     UUID,
    review_round                INTEGER             NOT NULL DEFAULT 1,  -- 재제출 횟수
    submitted_at                TIMESTAMPTZ,
    reviewed_at                 TIMESTAMPTZ,
    approved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_submissions_application
        FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_submissions_mission
        FOREIGN KEY (mission_id) REFERENCES missions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_submissions_participant
        FOREIGN KEY (participant_profile_id)
        REFERENCES participant_profiles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_submissions_operator
        FOREIGN KEY (reviewed_by_operator_id)
        REFERENCES users (id) ON DELETE SET NULL,
    -- application당 제출물은 1개 (재제출은 status 변경 + review_round 증가)
    CONSTRAINT uq_submissions_application
        UNIQUE (application_id),
    CONSTRAINT chk_submissions_review_round_positive
        CHECK (review_round >= 1)
);

COMMENT ON COLUMN submissions.media_urls IS
    'JSON 배열: [{"url":"https://...","type":"image","order":1}, ...]';
COMMENT ON COLUMN submissions.mission_id IS
    '역정규화 컬럼: application→mission join 없이 직접 조회 가능';

-- ----------------------------------------------------------------
-- TABLE: submission_histories (제출물 상태 변경 이력 — Audit Trail)
-- ----------------------------------------------------------------
CREATE TABLE submission_histories (
    id              UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id   UUID                NOT NULL,
    from_status     submission_status,                      -- NULL = 최초 생성
    to_status       submission_status   NOT NULL,
    changed_by_id   UUID                NOT NULL,           -- 변경 주체 (운영자/참여자)
    reason          TEXT,
    changed_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_submission_histories_submission
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    CONSTRAINT fk_submission_histories_user
        FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE RESTRICT
);
```

### 3-4. 보상 & 정산 도메인

```sql
-- ================================================================
-- FILE: 005_create_rewards.sql
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: point_ledgers (포인트 원장 — 불변 이벤트 로그)
-- ----------------------------------------------------------------
CREATE TABLE point_ledgers (
    id                      UUID                        DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_profile_id  UUID                        NOT NULL,
    transaction_type        point_transaction_type      NOT NULL,
    amount                  INTEGER                     NOT NULL,   -- 양수: 적립, 음수: 차감
    balance_after           INTEGER                     NOT NULL,   -- 트랜잭션 후 잔액
    reference_type          VARCHAR(50),                            -- 'submission', 'settlement' 등
    reference_id            UUID,                                   -- 참조 레코드 ID
    description             TEXT,
    created_at              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_point_ledgers_participant
        FOREIGN KEY (participant_profile_id)
        REFERENCES participant_profiles (id) ON DELETE RESTRICT,
    CONSTRAINT chk_point_ledgers_amount_nonzero
        CHECK (amount != 0),
    CONSTRAINT chk_point_ledgers_balance_non_negative
        CHECK (balance_after >= 0)
);

-- 원장은 수정/삭제 불가 원칙 — 잘못된 처리는 ADJUST_MANUAL로 보정
COMMENT ON TABLE point_ledgers IS
    '포인트 원장: INSERT ONLY 원칙. 잘못된 트랜잭션은 역트랜잭션으로 보정.';

-- ----------------------------------------------------------------
-- TABLE: settlements (정산 요청 및 처리 내역)
-- ----------------------------------------------------------------
CREATE TABLE settlements (
    id                          UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_profile_id      UUID                NOT NULL,
    status                      settlement_status   NOT NULL DEFAULT 'REQUESTED',
    total_points                INTEGER             NOT NULL,   -- 신청 포인트
    fee_points                  INTEGER             NOT NULL DEFAULT 0, -- 플랫폼 수수료 (포인트)
    net_points                  INTEGER             NOT NULL,   -- 실 지급 포인트
    exchange_rate               DECIMAL(10, 4),                -- 포인트→원 환율 (예: 1.0000)
    net_amount_krw              DECIMAL(12, 2),                -- 실 지급액 (원)
    bank_name                   VARCHAR(50)         NOT NULL,
    account_number              VARCHAR(30)         NOT NULL,
    account_holder              VARCHAR(50)         NOT NULL,
    processed_by_operator_id    UUID,
    reject_reason               TEXT,
    requested_at                TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    processed_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_settlements_participant
        FOREIGN KEY (participant_profile_id)
        REFERENCES participant_profiles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_settlements_operator
        FOREIGN KEY (processed_by_operator_id)
        REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_settlements_total_positive
        CHECK (total_points > 0),
    CONSTRAINT chk_settlements_fee_non_negative
        CHECK (fee_points >= 0),
    CONSTRAINT chk_settlements_net_equals_total_minus_fee
        CHECK (net_points = total_points - fee_points),
    CONSTRAINT chk_settlements_amount_positive
        CHECK (net_amount_krw IS NULL OR net_amount_krw > 0)
);
```

### 3-5. 알림 & 감사 도메인

```sql
-- ================================================================
-- FILE: 006_create_notifications_audit.sql
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: notifications (사용자 알림)
-- ----------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID                NOT NULL,
    type        notification_type   NOT NULL,