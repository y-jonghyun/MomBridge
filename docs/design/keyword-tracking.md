# 설계안: 키워드 추천 · 리뷰 유입 성과 리포트

- 상태: **구현 완료 · 배포 전 확인 대기** (브랜치 `feature/keyword-tracking`, 아직 push하지 않음)
- 작성일: 2026-10-21 / 진행 갱신: 2026-10-21
- 대상 코드: `dd80742` 기준

---

## 진행 상황 (2026-10-21)

### 커밋 (기존 문제 수정을 먼저 분리)

| 커밋 | 내용 |
|---|---|
| `fix(db)` | 결제 컬럼 마이그레이션 드리프트 보정 (`ADD COLUMN IF NOT EXISTS`, 이미 컬럼이 있는 DB에서도 안전) |
| `ci` | Jest·supertest 도입, 문서 파일이던 `ci-cd.yml` → `docs/ci-cd-design.md`, 실제 `ci.yml`(Postgres 서비스·마이그레이션 일치 검사·타입 검사), lock 파일 재동기화 |
| `fix(api)` | trust proxy, zod 입력 검증, 결제 금액 검증(Toss 승인 **전에** 확인), 재제출 API, 중복 정산 방지 |
| `fix(api)` | 미션 스키마 타입이 `any`로 넓어지던 문제 |
| `feat(backend)` | 키워드 추천, 추적 링크, 클릭 집계, 리뷰 확인, 리포트, 보관 기간 배치, 운영 설정 |
| `feat(frontend)` | `/r/[code]` 프록시, 광고주·체험단원·운영자 화면, 공유 리포트 |

### 테스트
- 백엔드 124개 통과 (로컬 Postgres 17 기준). DB가 없으면 통합 테스트 42개는 건너뛰고 82개 실행.
- 필수 11개 항목: `tests/unit/keywords|tracking|review-check.test.ts`, `tests/integration/*.test.ts`에 각각 "필수 N"으로 표기.
- 프론트엔드: `tsc --noEmit`, `next build` 통과. 로컬에서 프론트 → 백엔드 프록시 전체 흐름(지원 승인 → 가이드 → 링크 클릭 → 302 + UTM → 모바일/봇/고유 방문자 기록 → 리포트)을 직접 실행해 확인. 백엔드가 꺼져 있을 때 "이동 중" 대기 페이지와 자동 재시도도 확인.
- **GitHub Actions CI는 아직 실행되지 않음** (push 전).

### 승인 후 바뀐 점
- **대가 표시를 못 찾으면 자동 거부·수정 요청을 하지 않고 `NEEDS_MANUAL_REVIEW`(수동 확인 필요)** 로 둔다. 승인은 `AUTO_PASSED` 또는 운영자 `MANUAL_CONFIRMED`일 때만 가능. 수동 확인 시 운영자·시각·사유를 `submissions`와 `audit_logs`에 기록.
- **표시 위치 반영**: 공정위 「추천·보증 등에 관한 표시·광고 심사지침」 개정(2024.12.1 시행)으로 블로그 등 문자 매체는 표시문구를 **"게시물의 제목 또는 첫 부분"**에 둬야 한다(종전 "첫 부분 또는 끝 부분"에서 변경). 제목, 또는 본문 앞 200자(설정값)에서 찾으면 통과. 끝에만 있으면 `DISCLOSURE_NOT_AT_TOP`로 수동 확인. 같은 개정에서 '체험단', '선물', '~에서 보내주셨어요', '소정의 수수료를 지급받을 수 있음' 등은 명확한 표시가 아닌 예시로 명시돼 있어 인정 문구에서 뺐다.
- 첫 본문 요소가 이미지면 "이미지 속 대가 표시 확인 필요" 경고를 운영자에게 보여준다.
- 블로그 리뷰 흐름(블로그 URL 필수·자동 확인·승인 차단)은 **미션 유형 `REVIEW`** 에만 적용. 다른 유형은 기존 그대로.
- 추적 링크 도메인은 `TRACKING_BASE_URL`(기본 `https://mombridge.vercel.app`) 설정값.
- 키워드 도구는 `KEYWORD_TOOL_PROVIDER=mock`이 기본. 화면에 "샘플 데이터" 배지 표시.
- 배치는 GitHub Actions `daily-jobs.yml`(매일 03:30 KST) → `POST /api/v1/internal/jobs/daily`.

### Render 슬립과 리다이렉트 지연 (확인 결과)
- `keep-alive.yml`은 10분마다로 설정돼 있지만, **실제 실행 간격은 최근 100회 기준 중앙값 250분, 최소 97분, 최대 584분**이다. GitHub 예약 실행이 크게 밀리기 때문에, Render 무료 플랜(15분 유휴 시 슬립)이라면 대부분의 시간 동안 잠들어 있게 된다.
- 다만 오늘 측정에서는 마지막 ping 후 수 시간이 지났는데도 `/health`가 0.4~0.7초에 응답했다. 유료 인스턴스이거나 다른 트래픽이 있는 것으로 보이며, **Render 대시보드에서 플랜 확인이 필요**하다.
- 대응: 프론트 `/r/[code]`가 백엔드 응답을 9초 기다리고, 늦으면 "페이지로 이동하고 있습니다" 화면을 보여주며 1초 간격으로 최대 6회 자동 재시도한다(최대 약 1분). 재시도 요청은 같은 방문자가 이미 집계됐으면 다시 세지 않는다. 그래도 슬립에서 깨는 동안 독자가 수십 초를 기다릴 수 있으므로, **무료 플랜이면 정식 오픈 전에 상시 실행 플랜으로 바꾸거나 외부 모니터(5분 간격)를 두는 것을 권장**한다.

### 배포 전 해야 할 일
1. 운영 DB 백업 및 상태 확인 (아래 "운영 DB 백업·상태 확인").
2. 환경변수 설정
   - Render(백엔드): `CLICK_HASH_SECRET`(32자 이상), `TRACKING_PROXY_SECRET`, `INTERNAL_JOB_TOKEN`, `TRACKING_BASE_URL`, `KEYWORD_TOOL_PROVIDER=mock`
   - Vercel(프론트, 서버 전용): `TRACKING_PROXY_SECRET`(백엔드와 같은 값), `TRACKING_BACKEND_URL`
   - GitHub: secret `MOMBRIDGE_INTERNAL_JOB_TOKEN`, (선택) variable `MOMBRIDGE_BACKEND_URL`
   - `CLICK_HASH_SECRET`이 없으면 리다이렉트만 되고 클릭은 기록되지 않는다. `TRACKING_PROXY_SECRET`이 없으면 모든 방문자가 Vercel IP로 보여 고유 방문자 집계가 틀어진다.
3. **`https://mombridge.vercel.app`이 현재 `DEPLOYMENT_NOT_FOUND`를 반환한다.** 실제 프론트 배포 주소를 확인해 `TRACKING_BASE_URL`과 `FRONTEND_URL`에 넣어야 한다.
4. 실제 네이버 블로그 글 1~2개로 게시글 확인 결과를 점검. 스마트에디터 HTML 구조는 공개 자료를 기준으로 구현했고 실제 글로는 검증하지 못했다.
5. 개인정보처리방침 반영 (6절).
6. 정식 도메인 구매 후 Vercel에 연결하고 `TRACKING_BASE_URL` 변경 (글에 링크가 들어가기 전에).

### 운영 DB 백업·상태 확인 (직접 실행할 명령)
접속 문자열은 본인 터미널의 환경변수에만 넣고 대화에는 붙이지 마세요. Supabase는 **직접 연결(5432) 또는 Session pooler** 주소를 써야 합니다(Transaction pooler 6543은 pg_dump가 지원하지 않음). `pg_dump`는 서버와 같거나 더 높은 메이저 버전이어야 합니다.

```powershell
# 0) 접속 문자열을 이 터미널 세션에만 설정
$env:PROD_DB_URL = "postgresql://...:5432/postgres"

# 1) 백업 (custom 포맷, 복원 가능 여부까지 확인)
pg_dump --format=custom --no-owner --no-privileges --file "mombridge_prod_$(Get-Date -Format yyyyMMdd_HHmm).dump" "$env:PROD_DB_URL"
pg_restore --list (Get-ChildItem mombridge_prod_*.dump | Sort-Object LastWriteTime | Select-Object -Last 1).FullName | Select-Object -First 15

# 2) 상태 확인 (읽기 전용)
psql "$env:PROD_DB_URL" -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
psql "$env:PROD_DB_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'missions' AND column_name IN ('paymentStatus','paymentKey','orderId','totalAmount','paidAt') ORDER BY 1;"
cd C:\Mombridge\backend; $env:DATABASE_URL = $env:PROD_DB_URL; npx prisma migrate status; Remove-Item Env:DATABASE_URL
```

결과 해석:
- `_prisma_migrations`에 init·add_community 2건이 있고 결제 컬럼 5개가 보이면 → 보정 마이그레이션은 `IF NOT EXISTS`라 그대로 배포해도 안전.
- `_prisma_migrations` 테이블이 없으면(`db push`로 만든 DB) → 배포 전에 `prisma migrate resolve --applied`로 기존 마이그레이션 3개를 적용된 것으로 표시해야 한다. 결과를 알려주시면 명령을 정리해 드립니다.
- Supabase 유료 플랜이면 대시보드 Database → Backups에서 자동 백업도 확인.

---

## 0. 착수 전 확인 결과

### 0-1. 네이버 검색광고 API 키워드 도구 (공식 문서 확인)

출처: 공식 API 명세 `naver.github.io/searchad-apidoc` (`assets/json/ncc-keywordstool.json`), 공식 샘플 `github.com/naver/searchad-apidoc`, 공식 공지 2020-12-18 「키워드 도구 기능의 빈번한 429 에러 발생에 대한 가이드」, 공식 오류 코드표.

| 항목 | 확인 내용 |
|---|---|
| 엔드포인트 | `GET https://api.searchad.naver.com/keywordstool` |
| 인증 | OAuth 아님. 요청마다 헤더 4개: `X-Timestamp`(ms), `X-API-KEY`(액세스 라이선스), `X-Customer`(광고주 계정 ID), `X-Signature` = Base64(HMAC-SHA256(secretKey, `"{timestamp}.{METHOD}.{uri}"`)). uri는 쿼리스트링 제외 경로(`/keywordstool`) |
| 주요 파라미터 | `hintKeywords`(쉼표 구분, **최대 5개**), `showDetail=1`(경쟁 정도 등 상세 포함), 그 외 `siteId`, `biztpId`, `event`, `month` |
| 응답 | `{ keywordList: RelKwdStat[] }` |
| 응답 필드 | `relKeyword`, `monthlyPcQcCnt`, `monthlyMobileQcCnt`(최근 30일 검색량), `monthlyAvePcClkCnt`, `monthlyAveMobileClkCnt`, `monthlyAvePcCtr`, `monthlyAveMobileCtr`, `plAvgDepth`, `compIdx` |
| 호출 한도 | **수치가 공개돼 있지 않음.** 공지상 "호출 대상 계정당 속도 제한, 전체 사용량에 따라 유동적". 초과 시 HTTP 429 / 오류코드 1016 "너무 많은 접속". 키워드 도구는 429 시 **다른 기능보다 5~6배 길게 sleep** 후 재시도, 짧은 시간에 429가 연속되면 **최소 5분 전체 호출 중단** 권고 |

**요청서 설명과 다르거나 보충할 점**

1. **검색량 필드 타입**: 명세상 `monthlyPcQcCnt`가 `string`으로 정의돼 있고 10 미만이면 `"<10"`. 실제로는 숫자로 오는 경우도 많아 **숫자·문자열 둘 다** 파싱합니다. 클릭수·CTR 등도 명세상 string입니다.
2. **경쟁 정도 값**: 명세는 `low/mid/high`로 적혀 있지만 실제 응답은 한글(`낮음/중간/높음`)로 오는 사례가 널리 보고됩니다. 둘 다 수용하고, 모르는 값은 `unknown`으로 처리합니다. 또 `compIdx`는 **PC 광고 기준** 경쟁도로, 블로그 노출 경쟁도와는 다릅니다(리포트·화면에 주석 표기).
3. **"월간 검색량"의 정의**: 달력 월이 아니라 **최근 30일 합계**입니다.
4. **호출 한도는 수치로 보장되지 않습니다.** 그래서 캐시를 기본으로 두고, 동시 호출 1건 + 429 백오프 + 실패 시 만료된 캐시라도 반환하는 방식으로 설계했습니다.
5. **hintKeywords 공백**: 공백이 포함된 힌트는 오류를 낸다는 보고가 있어 공백을 제거해 보냅니다(키 발급 후 실측으로 확인 필요).
6. **확인 필요(약관)**: 검색광고 API는 광고 운영용으로 제공됩니다. 조회 결과를 **우리 서비스의 광고주(제3자)에게 보여주는 용도**가 이용약관에 맞는지 검색광고센터 약관이나 고객센터 문의로 확인해야 합니다. 위반 시 키가 정지될 위험이 있습니다. 어댑터 구조라 다른 출처로 교체할 수는 있습니다.
7. API 키는 **플랫폼 운영사 검색광고 계정 1개**로 발급한다고 가정합니다(검색광고센터 → 도구 → API 사용 관리).

### 0-2. 현재 플랫폼 구조와 새 기능의 연결 위치

| 요청서 용어 | 현재 코드 | 비고 |
|---|---|---|
| 캠페인 | `Mission` | 캠페인 코드 없음 → `campaignCode` 추가 |
| 광고주 | `ClientProfile` (role `CLIENT`) | `category`(업종), `regionSi/Gu/Dong` 보유 → 키워드 기본값으로 사용 |
| 체험단원 | `ParticipantProfile` (role `PARTICIPANT`) | |
| 체험단원 × 캠페인 | `Application` (`@@unique([missionId, participantId])`) | **추적 링크를 여기에 1:1로 붙임.** 승인(APPROVED) 시 발급 |
| 리뷰 제출 | `Submission` (`applicationId @unique`, `snsPostUrl`) | 제출 확인 결과 필드 추가 |
| 검수 | `PATCH /submissions/:id/review` (OPERATOR 전용) | 대가 표시 미확인 시 승인 차단 |
| 캠페인 생성 | `POST /missions/pay-and-create` (CLIENT, 결제 후 생성), `POST /missions` (OPERATOR) | 키워드·도착 URL을 생성 폼에 추가 |

**작업에 직접 영향을 주는 기존 문제** (함께 정리하지 않으면 새 기능이 제대로 동작하지 않음)

| # | 문제 | 영향 | 제안 |
|---|---|---|---|
| A | `app.set('trust proxy')` 미설정. Render 프록시 뒤에서 `req.ip`가 프록시 IP로 잡힘 | 모든 방문자가 같은 해시 → **고유 방문자·레이트리밋이 전부 틀어짐** | `trust proxy = 1` 설정 (배포 환경 확인 후) |
| B | `pay-and-create`, `POST /missions`가 `req.body`를 그대로 `prisma.mission.create`에 펼침 | 새 필드(`destinationUrl`, `campaignCode`)를 검증 없이 주입 가능 | 두 라우트에 zod 화이트리스트 적용 |
| C | 재제출 경로 없음. `Submission.applicationId`가 unique인데 수정 요청(REVISION) 후 다시 `POST`하면 unique 위반 | "대가 표시 누락 → 수정 요청 → 재제출" 흐름이 불가능 | `PATCH /submissions/:id/resubmit` 추가 |
| D | 광고주가 생성 후 미션을 수정할 API 없음 | 키워드·도착 URL 변경 불가 | 키워드·도착 URL 전용 PATCH 추가 |
| E | **마이그레이션 드리프트**: `Mission.paymentStatus/paymentKey/orderId/totalAmount/paidAt`이 schema에는 있지만 migrations에는 없음. `prisma/prisma-schema.prisma` 사본도 따로 존재 | 새 마이그레이션 생성 시 기존 필드까지 섞이거나, 운영 DB에서 `migrate deploy`가 실패할 수 있음 | 운영 DB 상태 확인 후 드리프트 보정 마이그레이션을 먼저 분리 커밋 (아래 질문 Q4) |
| F | 백엔드에 테스트 러너 없음. `tests/automated-tests.spec.ts`, `.github/workflows/ci-cd.yml`은 실제 코드가 아닌 **마크다운 문서** | 테스트 기반이 없음 | backend에 Jest + ts-jest + supertest 도입 |
| G | `express-rate-limit`은 의존성에만 있고 사용처 없음 | — | 리다이렉트·키워드 조회에 사용 |
| H | `docker-compose.yml`에 JWT 시크릿 하드코딩 | 보안 요구 6과 충돌 (이번 범위에서 신규 비밀값은 추가하지 않음) | 별도 정리 권장 |

배포 구성: 백엔드 Render(`mombridge-backend.onrender.com`, 무료 플랜이라 GitHub Actions가 10분마다 깨움), 프론트 Vercel(`mombridge.vercel.app`). **아직 자체 도메인이 없습니다** (질문 Q1).

---

## 1. 스키마 변경 (Prisma)

```prisma
// ── Mission 확장 ─────────────────────────
model Mission {
  // ...기존 필드
  campaignCode   String  @unique @db.VarChar(12)   // utm_campaign. 생성 시 랜덤 8자
  destinationUrl String? @db.VarChar(2048)         // http/https만. 등록 시 정규화
  keywords       MissionKeyword[]
  trackingLinks  TrackingLink[]
  shareLinks     ReportShareLink[]
}

enum KeywordRole { MAIN SUB }

model MissionKeyword {            // 광고주가 확정한 키워드 + 확정 당시 지표 스냅샷
  id               String      @id @default(uuid()) @db.Uuid
  missionId        String      @db.Uuid
  keyword          String      @db.VarChar(100)
  role             KeywordRole
  monthlyPcQc      Int?        // "<10" → null + isLowVolume
  monthlyMobileQc  Int?
  isLowVolume      Boolean     @default(false)
  compIdx          String?     @db.VarChar(10)  // low|mid|high|unknown
  snapshotAt       DateTime    @default(now())
  mission Mission @relation(fields: [missionId], references: [id], onDelete: Cascade)
  @@unique([missionId, keyword])
  @@index([missionId, role])
  @@map("mission_keywords")
}
// "메인 1개" 제약은 서비스 계층 + 부분 유니크 인덱스(raw SQL: WHERE role='MAIN')

model KeywordCache {
  cacheKey   String   @id @db.VarChar(300)  // 정규화·정렬된 힌트 키워드 join
  response   Json                            // 파싱 완료된 결과
  fetchedAt  DateTime
  expiresAt  DateTime
  @@index([expiresAt])
  @@map("keyword_cache")
}

// ── 추적 링크 ───────────────────────────
model TrackingLink {
  id            String   @id @default(uuid()) @db.Uuid
  code          String   @unique @db.VarChar(16)  // utm_content 겸용
  applicationId String   @unique @db.Uuid         // 체험단원 × 캠페인
  missionId     String   @db.Uuid
  participantId String   @db.Uuid
  createdAt     DateTime @default(now())
  disabledAt    DateTime?
  clicks  ClickEvent[]
  daily   ClickDaily[]
  @@index([missionId])
  @@index([participantId])
  @@map("tracking_links")
}

enum DeviceType { MOBILE PC UNKNOWN }

model ClickEvent {               // 원본: 보관 기간(기본 90일) 후 삭제
  id            BigInt     @id @default(autoincrement())
  linkId        String     @db.Uuid
  occurredAt    DateTime   @default(now())
  dayKey        DateTime   @db.Date            // KST 기준 날짜
  refererDomain String?    @db.VarChar(255)    // 호스트명만
  device        DeviceType
  isBot         Boolean
  botRule       String?    @db.VarChar(50)     // 어떤 규칙에 걸렸는지 (UA 원문 저장 안 함)
  isUnique      Boolean                        // 당일 첫 방문 여부
  link TrackingLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@index([linkId, occurredAt])
  @@index([occurredAt])
  @@map("click_events")
}

model ClickDailyVisitor {        // 당일 고유 판정용. 원본과 같이 삭제
  linkId      String   @db.Uuid
  dayKey      DateTime @db.Date
  visitorHash String   @db.Char(64)            // HMAC-SHA256 hex
  @@id([linkId, dayKey, visitorHash])
  @@index([dayKey])
  @@map("click_daily_visitors")
}

model ClickDaily {               // 영구 보관되는 일 단위 집계
  linkId         String   @db.Uuid
  dayKey         DateTime @db.Date
  totalClicks    Int      @default(0)          // 봇 제외
  uniqueVisitors Int      @default(0)
  mobileClicks   Int      @default(0)
  pcClicks       Int      @default(0)
  botClicks      Int      @default(0)          // 참고용
  referers       Json     @default("{}")       // { "blog.naver.com": 12, ... }
  link TrackingLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  @@id([linkId, dayKey])
  @@index([dayKey])
  @@map("click_daily")
}

// ── 리뷰 제출 확인 ──────────────────────
enum PostCheckStatus { PENDING PASSED FAILED ERROR }

model Submission {
  // ...기존 필드
  checkStatus     PostCheckStatus?
  checkedAt       DateTime?
  checkResult     Json?     // { exists, isPublic, hasTrackingLink, hasMainKeyword, hasDisclosure, matchedPhrase, httpStatus }
  disclosureOk    Boolean?  // 승인 차단 판정에 사용
  manualDisclosureBy String? @db.Uuid  // 확인 불가(ERROR) 시 운영자 수동 확인자 (Q3)
}

// ── 리포트 공유 ─────────────────────────
model ReportShareLink {
  id         String    @id @default(uuid()) @db.Uuid
  missionId  String    @db.Uuid
  tokenHash  String    @unique @db.Char(64)   // 원문 토큰은 발급 시 1회만 노출
  createdBy  String    @db.Uuid
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  mission Mission @relation(fields: [missionId], references: [id], onDelete: Cascade)
  @@index([missionId])
  @@map("report_share_links")
}

// ── 운영 설정 ───────────────────────────
model PlatformSetting {
  key       String   @id @db.VarChar(100)
  value     Json
  updatedBy String?  @db.Uuid
  updatedAt DateTime @updatedAt
  @@map("platform_settings")
}
```

**설정값** (코드 기본값 + `platform_settings`로 덮어쓰기, 메모리 캐시 60초)

| 키 | 기본값 |
|---|---|
| `keyword.cacheTtlDays` | 7 |
| `keyword.sort` | `{ mode: "recommended", volumeBand: [100, 5000], weights: { band: 0.4, competition: 0.35, regionCategory: 0.25 } }` |
| `keyword.maxSubKeywords` | 5 |
| `click.retentionDays` | 90 |
| `click.botRules` | `[{name, pattern}]` — `bot\|crawl\|spider\|slurp`, `Yeti`, `facebookexternalhit`, `kakaotalk-scrap`, `Slackbot`, `Twitterbot`, `Discordbot`, `TelegramBot`, `HeadlessChrome`, 빈 UA 등 |
| `click.rateLimit` | `{ perVisitorPerLinkPerMin: 10, perIpPerMin: 120 }` |
| `submission.disclosurePhrases` | `소정의 원고료`, `원고료를 (지원\|제공)받`, `제품을 (무상으로 )?제공받`, `협찬`, `광고`, `체험단`, `대가를 (지급\|제공)받` (정규식) |
| `report.shareMaxDays` | 30 |

**비밀값** (env 전용, `env.ts`에 추가, 운영 환경에서 누락 시 기동 실패): `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID`, `CLICK_HASH_SECRET`(32바이트 이상), `TRACKING_BASE_URL`, `INTERNAL_JOB_TOKEN`.

---

## 2. 핵심 로직

### 2-1. 키워드 추천
- `KeywordToolAdapter` 인터페이스: `fetchRelated(hints: string[]): Promise<RawRelKwd[]>`. 구현체는 `NaverSearchAdAdapter`(HMAC 서명), 테스트용은 `MockKeywordToolAdapter`.
- 파서 `parseVolume(v)`: `number` → 그대로, `"<10"` → `{ value: null, low: true }`, `"1,234"` → 1234, 그 외 → null. 합계 계산과 정렬에서 `<10`은 5로 간주하고 화면에는 "<10"으로 표시.
- `compIdx` 정규화: `낮음/low → low`, `중간/mid → mid`, `높음/high → high`, 그 외 → `unknown`.
- 힌트 생성: 입력(업종·지역·상품명)과 "지역+업종" 조합(공백 제거)을 만들어 최대 5개까지 전송.
- 점수: `band`(검색량이 구간 안이면 1, 밖이면 거리만큼 감점) × w1 + `competition`(low 1 / mid 0.5 / high 0 / unknown 0.3) × w2 + `regionCategory`(키워드에 지역어와 업종어가 모두 들어가면 1, 하나만 들어가면 0.5) × w3. `mode`가 `volume`이나 `competition`이면 해당 지표 단일 정렬.
- 캐시: `cacheKey` = 정규화(소문자·공백 제거)한 힌트를 정렬해 join. 유효한 캐시가 있으면 API를 호출하지 않음. API가 실패하거나 429를 반환하면 **만료된 캐시라도** `stale: true`로 반환. 동시 호출은 프로세스당 1건(직렬 큐). 429가 오면 서킷 차단(5분).

### 2-2. 추적 링크
- 발급 시점: `Application`이 APPROVED가 될 때(운영자 승인 라우트). 이미 승인된 기존 지원은 마이그레이션 스크립트로 일괄 발급.
- 코드: `crypto.randomBytes` → base62 **12자**(약 71비트). 충돌 시 재시도. 순번·UUID 일부 사용 금지.
- 링크 형식: `${TRACKING_BASE_URL}/r/{code}`.
- 도착 URL 검증(등록 시): `new URL()` 파싱 성공, 프로토콜 `http:`/`https:`만, 사용자정보(`user:pass@`) 금지, 2048자 이하.
- 리다이렉트 대상은 **항상 DB의 `mission.destinationUrl`에서 서버가 조립**하고, 요청 파라미터는 전혀 쓰지 않음 → 오픈 리다이렉트가 구조적으로 불가능.
- UTM: 기존 쿼리는 유지하고 `utm_source=mombridge`, `utm_medium=blog`, `utm_campaign={campaignCode}`, `utm_content={code}`를 덮어씀. 해시(`#...`)는 보존.

### 2-3. 리다이렉트 + 클릭 기록 `GET /r/:code`
1. 코드 형식 검사(base62 12자). 아니면 404.
2. 링크와 도착 URL 조회. 프로세스 LRU 캐시(5분)에 넣어 DB가 잠깐 불안정해도 리다이렉트는 유지. 링크 없음·비활성·도착 URL 없음 → 404 안내 페이지(다른 곳으로 이동하지 않음).
3. **302 응답을 먼저 보냄** (`Cache-Control: no-store`, `X-Robots-Tag: noindex`).
4. 응답 후 비동기로 기록. 모든 예외는 삼키고, 로그에는 링크 코드와 오류 종류만 남김(IP·UA 기록 안 함).
   - `HEAD` 요청이나 봇 규칙에 걸린 요청 → `isBot=true`, 해시 생성 안 함, 집계 제외.
   - `visitorHash = HMAC-SHA256(CLICK_HASH_SECRET, dayKey + "|" + ip + "|" + ua)`. 날짜를 섞어 **다른 날의 방문끼리 연결할 수 없게** 함(하루 1회 집계 요건에 필요한 만큼만 식별).
   - `INSERT ... ON CONFLICT DO NOTHING` into `click_daily_visitors` → 삽입되면 `isUnique=true`.
   - `refererDomain`: `new URL(referer).hostname`만 저장.
   - 기기: UA에 `Mobi|Android|iPhone` → MOBILE, 일반 데스크톱 UA → PC, 그 외 → UNKNOWN.
5. 레이트리밋(`express-rate-limit`, 메모리 저장소):
   - 방문자(해시) × 링크당 분당 10회를 넘으면 리다이렉트는 하되 **기록하지 않음**(독자 경험 유지).
   - IP당 분당 120회를 넘으면 429 응답.

### 2-4. 리뷰 제출 확인
- URL 검증: `https://blog.naver.com/{blogId}/{logNo}`, `https://m.blog.naver.com/{blogId}/{logNo}`, `PostView.naver?blogId=&logNo=` 세 형식만 허용. `naver.me` 단축 URL은 거절하고 원본 주소를 안내. blogId·logNo를 추출해 정규화.
- `PostContentFetcher` 어댑터: `https://blog.naver.com/PostView.naver?blogId=..&logNo=..`를 **제출(재제출) 1건당 1회** 조회. robots.txt `User-agent: *` 기준으로 허용된 경로임. 타임아웃 8초, 리다이렉트 최대 2회, 응답 2MB 제한, 식별 가능한 UA 사용. 다른 페이지 탐색·반복 조회 없음.
- 판정:
  - `exists/isPublic`: 200 응답이고 본문 컨테이너가 있으면 통과. 비공개·삭제·오류 페이지 마커가 보이면 실패.
  - `hasTrackingLink`: HTML에 해당 링크 `code`가 있는지(링크 카드와 일반 링크 모두).
  - `hasMainKeyword`: 태그를 제거한 본문에서 공백 무시 포함 여부.
  - `hasDisclosure`: 설정의 정규식 중 하나라도 맞으면 통과. 맞은 문구를 기록.
- 결과 처리:
  - ~~대가 표시 없음 → 자동 수정 요청~~ **(승인 후 변경)** 대가 표시를 제목·첫 부분에서 못 찾음, 끝에만 있음, 글을 못 불러옴, 비공개 → `disclosureCheck=NEEDS_MANUAL_REVIEW`. 상태는 `SUBMITTED` 그대로 두고 운영자가 직접 확인(사유 필수)하거나 수정 요청을 보낸다.
  - 추적 링크나 키워드 누락 → 운영자 검수 화면에 경고만 표시하고 자동 반려는 하지 않음(요청서는 대가 표시만 필수로 규정).
- `PATCH /submissions/:id/review`에 `status=APPROVED`가 와도 `disclosureCheck`가 `AUTO_PASSED`/`MANUAL_CONFIRMED`가 아니면 **422 `DISCLOSURE_REQUIRED`**로 거절.
- 수동 확인: `POST /submissions/:id/disclosure-confirm {reason}` (OPERATOR).

### 2-5. 보관 기간 배치 (일 1회, 멱등)
1. 어제까지의 원본을 `click_daily`로 롤업(upsert 재계산). 보관 기간 안의 날짜도 매일 다시 계산하므로 원본이 있는 동안에는 항상 정확함.
2. `dayKey < today - retentionDays`인 `click_events`, `click_daily_visitors`를 삭제. 단 해당 날짜가 `click_daily`에 롤업된 경우에만 삭제.
3. 만료된 `keyword_cache`, `report_share_links`도 정리.
- 실행 방식: 기존 keep-alive처럼 **GitHub Actions cron → `POST /api/v1/internal/jobs/daily`** (헤더 `X-Internal-Token`). 서버 프로세스 상주 크론은 Render 무료 플랜의 재시작·슬립 영향을 받기 때문.
- 리포트 조회는 오늘은 원본에서 실시간 계산하고, 어제 이전은 `click_daily`를 사용(배치가 하루 밀리면 해당 날짜는 원본으로 대체 계산).

---

## 3. API 목록 (`/api/v1` 기준, `/r`은 루트)

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| POST | `/keywords/recommend` | CLIENT, OPERATOR | `{category, region, product?, extra?[]}` → 추천 표 + `cached`, `stale` 여부. 사용자당 분당 10회 제한 |
| PUT | `/client/missions/:id/keywords` | CLIENT(소유자), OPERATOR | `{main, subs[]}` 확정 + 지표 스냅샷 저장 |
| PATCH | `/client/missions/:id/destination` | CLIENT(소유자), OPERATOR | 도착 URL 등록·변경 |
| POST | `/missions/pay-and-create`, `/missions` | 기존 | zod 화이트리스트 + `destinationUrl`, `keywords` 입력 허용, `campaignCode` 자동 생성 |
| GET | `/participant/missions/:missionId/guide` | PARTICIPANT(승인된 본인) | 메인·서브 키워드, 추적 링크, 대가 표시 예시 문구 |
| POST | `/submissions` | 기존 | 네이버 블로그 URL 검증 + 게시글 확인 1회 → 결과 포함 응답 |
| PATCH | `/submissions/:id/resubmit` | PARTICIPANT(본인) | REVISION 상태에서 URL 재제출 + 재확인 1회 |
| PATCH | `/submissions/:id/review` | 기존 | 대가 표시 미확인이면 승인 거절 |
| GET | `/r/:code` | 공개 | 302 리다이렉트 + 비동기 기록 |
| GET | `/client/missions/:id/report?from&to` | CLIENT(소유자), OPERATOR | 총 클릭·고유 방문자·일별 추이·리뷰별/체험단원별 순위·기기 비율·대가 표시 준수 현황 |
| POST | `/client/missions/:id/report/share` | CLIENT(소유자) | `{expiresInDays ≤ 30}` → 공유 URL(토큰 원문은 이때 1회만 반환) |
| GET | `/client/missions/:id/report/share` · DELETE `/…/share/:shareId` | CLIENT(소유자) | 공유 링크 목록·폐기 |
| GET | `/reports/shared/:token` | 공개(토큰) | 읽기 전용 리포트. 체험단원 이름 마스킹(홍*동) |
| GET | `/participant/reviews/stats` | PARTICIPANT | 내 리뷰별 클릭·고유 방문자 |
| GET | `/operator/reports/summary?from&to` | OPERATOR | 캠페인별·전체 합계, 리뷰당 평균 유입 |
| GET | `/operator/reports/export.csv?from&to` | OPERATOR | UTF-8 BOM CSV (엑셀 호환) |
| GET·PUT | `/operator/settings/:key` | OPERATOR | 설정값 조회·변경(키 화이트리스트 + zod 검증, AuditLog 기록) |
| POST | `/internal/jobs/daily` | 내부 토큰 | 롤업·보관 기간 삭제·캐시 정리 |

**소유권 검사**: 광고주 리포트·키워드·공유 API는 모두 `mission.clientProfileId === 내 프로필`을 확인하고, 아니면 **404**(존재 여부도 노출하지 않음). 기존 `client.routes.ts` 패턴과 같습니다.

CSV 컬럼: `campaign_code, mission_title, business_name, region, period_from, period_to, reviews, approved_reviews, total_clicks, unique_visitors, avg_clicks_per_review, mobile_ratio, disclosure_compliance_rate`

---

## 4. 화면

| 사용자 | 위치 | 내용 |
|---|---|---|
| 광고주 | `client/page.tsx` › 미션 등록 탭 | 「키워드 추천」 단계: 업종(프로필 기본값)·지역(구/동 기본값)·상품명 입력 → 조회 → 표(키워드, PC, 모바일, 합계, 경쟁 정도, 추천 점수, 메인 라디오, 서브 체크박스). `<10`은 회색 표기, 캐시/지난 데이터 배지, "경쟁 정도는 PC 검색광고 기준" 주석. 도착 URL 입력(형식 즉시 검증) |
| 광고주 | 내 미션 › 미션 상세 | 키워드·도착 URL 수정, **「성과 리포트」** 탭: KPI 카드(총 클릭, 고유 방문자, 리뷰당 평균), 일별 추이 차트, 리뷰별·체험단원별 순위 표, 기기 비율, 대가 표시 준수 현황, 고정 안내문 **"블로그 글의 추적 링크를 눌러 넘어온 방문만 집계됩니다. 블로그 조회수와는 다릅니다."**, 공유 링크 발급(만료일 선택)·폐기 |
| 공개 | `frontend/src/app/reports/shared/[token]/page.tsx` (신규) | 읽기 전용 리포트, 만료 일시 표시, 만료·폐기 시 안내 |
| 체험단원 | `participant/page.tsx` › 승인된 미션 | 「작성 가이드」: 메인·서브 키워드, **"글에 추적 링크 1개를 넣으세요"** + 링크 + 복사 버튼, 대가 표시 예시 문구 + 복사 버튼 |
| 체험단원 | 제출 폼 | URL 형식 즉시 검증, 제출 후 확인 결과 체크리스트(공개 ✓ / 추적 링크 ✓ / 메인 키워드 ✓ / 대가 표시 ✗ → 수정 안내), 재제출 버튼 |
| 체험단원 | 「내 리뷰 성과」 | 리뷰별 클릭·고유 방문자 |
| 운영자 | `operator/page.tsx` › 검수 | 확인 결과 표시, 대가 표시 미확인이면 승인 버튼 비활성 + 사유 표시 |
| 운영자 | 「유입 성과」 탭 | 기간 선택, 캠페인별 표, 전체 합계, CSV 내보내기 |
| 운영자 | 「설정」 탭 | 정렬 기준·캐시 TTL·보관 기간·봇 규칙·대가 표시 문구 편집 (Q6에서 축소 가능) |

차트는 새 의존성 없이 SVG 컴포넌트 1개로 구현합니다(막대·선 하나씩).

---

## 5. 보안

- 검색광고 API 키와 해시 비밀값은 **백엔드 env에만** 둡니다. `NEXT_PUBLIC_` 접두사 사용 금지, `.env.example`에는 키 이름만 적습니다. API 요청 헤더·서명은 로그에 남기지 않고, 오류 로그는 `status`, `code`만 남깁니다.
- winston 로그 포맷에 `headers`, `ip`, `x-forwarded-for`, `user-agent` 마스킹 필터를 추가합니다.
- 테스트로 확인: 프론트 빌드 산출물과 저장소에 키 문자열이 없는지 grep 검사(CI 스크립트).
- 공유 토큰은 32바이트 랜덤 값이며 DB에는 SHA-256 해시만 저장합니다.

## 6. 개인정보처리방침 반영 필요 사항 (보고)

블로그 독자는 회원이 아니지만 클릭 시 정보가 처리되므로 방침에 공개해야 합니다. 법률 검토를 권장합니다.

1. **처리 항목**: (추적 링크 클릭 시 자동 생성) 접속 일시, 유입 페이지 도메인, 기기 유형, 접속 IP·브라우저 정보를 복원할 수 없게 변환한 값. **IP 원문은 저장하지 않음**을 명시합니다.
2. **목적**: 광고주 캠페인 유입 통계 제공, 중복·부정 클릭 방지.
3. **보유 기간**: 변환값과 원본 클릭 기록은 90일 후 파기하고, 개인을 식별할 수 없는 일 단위 통계만 보관합니다.
4. **파기 방법**: 일 단위 배치로 DB 레코드를 삭제합니다.
5. **위탁·국외 이전**: 호스팅(Render, Vercel 등)의 리전과 수탁사를 기재합니다. 호스팅 사업자의 접근 로그에는 IP가 남을 수 있습니다.
6. 체험단원 관련: 제출한 블로그 글을 1회 조회해 공개 여부·문구 포함 여부를 확인한다는 사실과, 그 결과를 광고주에게 제공한다는 사실(체험단원 약관이나 방침).
7. 쿠키는 사용하지 않습니다(클릭 추적에 쿠키를 쓰지 않음).

> 참고: 해시값도 다른 정보와 결합하면 개인정보(가명정보)로 볼 여지가 있어, 날짜별로 해시 입력을 바꿔 다른 날끼리 연결하지 못하게 했습니다.

---

## 7. 테스트 계획

**도구**: backend에 `jest`, `ts-jest`, `supertest` 추가. 외부 연동(네이버 API, 블로그 조회, 시계)은 어댑터나 주입 방식으로 바꿔 Mock합니다. DB가 필요한 테스트는 `TEST_DATABASE_URL`(docker-compose의 Postgres, 별도 DB)에서 실행하고, 변수가 없으면 해당 테스트만 건너뜁니다(Q5).

| # | 필수 테스트 | 종류 | 검증 방법 |
|---|---|---|---|
| 1 | 키워드 응답 파싱(문자열 검색량 포함) | 단위 | `"<10"`, `"1,234"`, `1234`, `"낮음"/"low"`, 필드 누락, 빈 `keywordList` |
| 2 | 캐시 적중 시 API 미호출 | 단위 | Mock 어댑터 호출 0회. TTL이 지나면 1회. 429가 오면 만료 캐시를 `stale`로 반환 |
| 3 | 추적 코드 추측 불가능성 | 단위 | 1만 개 생성 시 중복 0, 길이와 문자집합 확인, 연속 생성 코드 간 공통 접두 없음, `crypto.randomBytes` 사용 확인(Math.random 미사용) |
| 4 | 등록되지 않은 URL로 리다이렉트 불가 | 통합 | `/r/:code?url=https://evil.com`, `next=`, 인코딩 변형 → Location이 항상 등록 URL + UTM. `javascript:`·`data:`·`ftp:`·사용자정보 포함 URL 등록 거절 |
| 5 | 기록 실패 시에도 리다이렉트 성공 | 통합 | 기록 저장소를 throw하도록 Mock → 302와 올바른 Location |
| 6 | 같은 방문자 하루 1회 고유 집계 | 통합 | 같은 IP·UA로 3회 → total 3, unique 1. 날짜를 바꾸면 unique 2. UA가 다르면 별도 방문자 |
| 7 | 봇 클릭 제외 | 통합 | Yeti, kakaotalk-scrap, 빈 UA, HEAD 요청 → `isBot`, 집계 0. 설정에 규칙을 추가하면 즉시 반영 |
| 8 | IP 원문 미저장 | 통합 | 클릭 후 모든 클릭 관련 테이블을 전체 덤프해 IP 문자열·UA 원문 검색 → 0건. 로그 캡처에도 없음 |
| 9 | 대가 표시 없으면 승인 거부 | 통합 | Mock 조회 결과에 문구 없음 → REVISION + 알림. 운영자 APPROVED 요청 → 422 |
| 10 | 다른 광고주 리포트 접근 거부 | 통합 | 광고주 B가 A의 리포트·공유·키워드 API 호출 → 404. 만료·폐기된 공유 토큰 → 410 |
| 11 | 보관 기간 지난 원본 삭제 후 일 집계 유지 | 통합 | 91일 전·89일 전 클릭 생성 → 배치 → 91일 전 원본·방문자 해시 삭제, `click_daily`는 유지, 리포트 합계 불변. 배치를 두 번 실행해도 결과 동일 |

추가 테스트: UTM 병합(기존 쿼리·해시 보존), 네이버 블로그 URL 형식 3종 수용과 그 외 거절, 키워드 정렬 모드별 순서, 레이트리밋(초과 시 기록 생략, 하드 리밋 429), CSV 헤더와 BOM.

---

## 8. 구현 순서 (승인 후)

1. 기반 정비: 마이그레이션 드리프트 보정, trust proxy, Jest 설정, zod 화이트리스트 (별도 커밋)
2. 스키마와 설정 모듈
3. 키워드 어댑터·파서·캐시·추천 API + 화면
4. 추적 링크 발급·리다이렉트·클릭 기록·레이트리밋
5. 제출 확인·재제출·승인 차단
6. 배치와 내부 잡, GitHub Actions cron
7. 리포트(광고주·공유·체험단원·운영자 CSV) + 화면
8. 전체 테스트 → 커밋 → 진행 문서(`docs/design/keyword-tracking.md`의 진행 상황 절) 갱신

---

## 9. 승인 전 결정 필요

| # | 질문 | 제안 |
|---|---|---|
| Q1 | 추적 링크 도메인. 현재 자체 도메인이 없음 | 자체 도메인을 연결하는 것이 가장 좋음. 당장은 `mombridge.vercel.app/r/:code` → Vercel rewrite → 백엔드. `TRACKING_BASE_URL`로 나중에 바꿀 수 있지만 **이미 배포된 글의 링크는 바뀌지 않으므로** 정식 오픈 전에 도메인 확정 필요 |
| Q2 | 검색광고 API 약관상 제3자 제공 용도 확인 | 운영사가 검색광고센터에 확인. 그동안은 Mock 어댑터로 개발 |
| Q3 | 게시글 조회 실패(네트워크 오류·차단) 시 처리 | 승인 차단은 유지하고, 운영자가 직접 확인한 뒤 "수동 확인" 처리(AuditLog 기록) 가능하게 |
| Q4 | 운영 DB 스키마가 현재 `schema.prisma`와 일치하는지(`db push` 사용 여부) | 운영 DB 확인 후 baseline 마이그레이션을 먼저 작성. 접근 정보를 주시면 읽기 전용으로 확인 |
| Q5 | DB 통합 테스트 환경 | 로컬 docker-compose Postgres를 테스트 DB로 사용. 실제 CI 워크플로(현재는 문서 파일)는 이번 범위에서 backend 테스트만 도는 최소 버전으로 교체할지 결정 |
| Q6 | 운영자 설정 화면 범위 | 1차는 API와 기본값만, 화면은 정렬 기준·대가 표시 문구·봇 규칙 3개로 축소 |
| Q7 | 공유 리포트에서 체험단원 이름 노출 | 마스킹(홍*동) + 블로그 링크만 표시 |
