# 7차 진행: 운영 점검 후속 (보안·안정성·기능)

- 작성일: 2026-10-22
- 범위: 운영 점검 요청 23건 중 구현 19건(P0·P1), 조사·제안 4건(P2) — P2는 [business-model.md](business-model.md)
- 상태: 브랜치 push 완료, PR 생성·리뷰 대기. 비밀값은 이 문서에 적지 않는다.

---

## 1. 브랜치와 머지 순서

화살표(→)로 이은 브랜치는 앞 브랜치 위에 쌓은 것이다. **앞 PR부터 머지**한다(GitHub은 앞 브랜치가 머지·삭제되면 다음 PR의 base를 main으로 바꿔 준다). 나머지는 순서와 무관하다.

| # | 브랜치 | 항목 | 운영 DB 영향 |
|---|---|---|---|
| 1 | `fix/enable-rls-all-tables` | P0-1 RLS | **있음** — 아래 3-1 |
| 2 | `fix/auth-rate-limit` → `fix/auth-session-hardening` → `feat/password-reset` → `feat/signup-consent-terms` | P0-2, P0-3(백엔드), #13, #12 | **있음** — 컬럼 1개·테이블 2개 추가 (3-2) |
| 3 | `fix/frontend-api-session` → `feat/exclude-self-clicks` | P0-3(프론트), #14, #8 → #19 | 없음 |
| 4 | `ops/automated-db-backup` | P0-4 | 없음 (설정 필요, 4절) |
| 5 | `chore/pin-node-22` | #5 | 없음 |
| 6 | `feat/health-ready` → `fix/json-body-limit` | #6 → #9 | 없음 |
| 7 | `feat/error-monitoring` | #7 | 없음 |
| 8 | `feat/auto-close-expired-missions` | #11 | **데이터 변경** — 3-3 |
| 9 | `fix/mission-detail-keywords` | #16 | 없음 |
| 10 | `feat/mission-visit-guide` | #15 | **있음** — 컬럼 1개 추가 |
| 11 | `fix/region-filter` | #17 | 코드로는 없음. 기존 행 정리는 3-4 |
| 12 | `feat/mission-cleanup-script` | #18 | `--apply`로 실행할 때만 (3-5) |

PR 링크: `https://github.com/y-jonghyun/MomBridge/compare/main...<브랜치>?expand=1` (쌓은 브랜치는 `compare/<앞 브랜치>...<브랜치>`로 열면 해당 변경만 보인다).

**통합 확인 (로컬)**: 위 브랜치를 모두 main에 차례로 합친 임시 브랜치에서 충돌 없음, 테스트 178개 통과, 마이그레이션·스키마 일치(`migrate diff` 차이 없음), 프론트 `next build` 성공.

## 2. 항목별 결과

### P0
1. **RLS** — 마이그레이션 `20261022100000_enable_rls_all_tables`: RLS가 꺼진 테이블에만 `ENABLE ROW LEVEL SECURITY`(정책 없음 = anon·authenticated 전부 차단, FORCE 안 함). 운영에서는 새 테이블 8개에만 실행된다. 기존 테이블의 RLS는 마이그레이션 기록 없이 Supabase에서 켠 것이었다.
   - 재발 방지: 테스트 `tests/integration/rls.test.ts`가 public 테이블 중 RLS가 꺼진 것이 있으면 실패한다(CI에서 매번 실행). 이후 새 테이블 마이그레이션에는 `ENABLE ROW LEVEL SECURITY`를 함께 넣는다(#12·#13 테이블에 적용함).
   - Prisma 영향 없음 확인: 비슈퍼유저·`NOBYPASSRLS`인 테이블 소유자 역할로 전체 테스트 통과(Supabase `postgres`와 같은 조건).
2. **로그인·가입 시도 제한** — 로그인 IP+이메일 15분 실패 5회, IP 15분 실패 30회(성공은 세지 않음), 가입 IP 1시간 20회, 재설정 메일 IP 15분 5회. 429 응답은 계정 유무와 무관하게 동일. 메모리 저장소(Render 인스턴스 1개 기준, 재시작 시 초기화).
3. **토큰·세션**
   - 프론트: 401이면 `/auth/refresh` 1회(동시 요청은 1번만) 후 재요청. 리프레시도 거절될 때만 로그아웃 → `/login?next=…&expired=1`(만료 안내, 로그인 후 원래 화면으로).
   - 백엔드: 리프레시 시 계정 활성·미삭제·`users.tokenVersion` 일치 확인. 비밀번호 변경·비활성화·재설정 시 버전 증가 → 다른 기기 세션 종료. 기존 토큰(버전 없음)은 0으로 간주해 배포 직후 전원 로그아웃되지 않음. access 토큰은 15분 무상태 그대로.
   - 이메일 소문자 저장, 조회는 대소문자 무시(예전 대소문자 혼용 계정도 로그인·중복 차단).
   - 가입 시 사용자·프로필·동의 기록을 한 트랜잭션(중첩 create)으로.
4. **자동 백업** — 4절.

### P1 운영 안정성
5. Node `engines: "22.x"`(백엔드·프론트), CI도 22.
6. `/health/ready`: `SELECT 1`(3초 제한), 실패 시 503 `{db: unreachable|timeout}`. `/health`는 keep-alive용으로 DB 미확인 유지. Render Health Check Path는 `/health` 그대로 두고, 외부 모니터(UptimeRobot 등)에 `/health/ready`를 건다.
7. **Sentry** (`@sentry/node`·`@sentry/nextjs` 10.75.3, DSN 없으면 꺼짐)
   - 결제·정산 경로 오류는 `area=payment|payout` 태그. 특히 "토스 승인 후 미션 저장 실패"(결제는 됐는데 미션 없음)는 fatal로 따로 보고. 토스 승인 거절, 정산 FAILED 처리도 보고.
   - 요청 본문·쿠키·쿼리·인증 헤더·IP·사용자 정보(id 외) 제거, 콘솔 기록 미전송. 로컬 수신기로 실제 전송 내용 확인함.
   - 프론트 SDK는 DSN이 있을 때만 불러와 공통 번들 크기 변화 없음(103kB).
   - 알림 설정(Sentry 대시보드): Alerts → Issue alert → 조건 `tag area equals payment`(또는 payout) → 메일/슬랙.
8. axios timeout 70초, 4초 넘으면 "서버를 준비하고 있어요" 안내, GET만 네트워크 오류·502/503/504 시 1회 재시도(결제·제출 POST는 재시도 안 함).
9. 본문 제한 100kb(가장 긴 필드 1만 자 ≈ 30KB, 파일 업로드 없음). 초과 413, 깨진 JSON 400(이전엔 500으로 기록됨).
10. **CORS 정리 (값 변경은 직접)** — Render `CORS_ORIGIN`을 `https://mombridge-frontend.vercel.app` 하나로 줄인다. Vercel 미리보기 주소는 배포마다 바뀌어 목록으로 관리할 수 없고, 미리보기에서 API를 시험할 때만 그 주소를 잠시 추가했다가 지운다. 정식 도메인을 연결하면 그 주소로 바꾼다(`TRACKING_BASE_URL`·`FRONTEND_URL`과 함께). 저장 시 Render가 재배포하므로 한가한 시간에.

### P1 기능·UX
11. 일 배치에 모집 마감 처리: 마감일(KST)이 오늘보다 앞선 OPEN 미션 → 승인·대기 지원자가 있으면 IN_PROGRESS, 없으면 CLOSED. 자정~03:30 사이에도 공개 목록·지원 API는 마감 미션을 제외.
12. 가입 동의: 필수(만 14세 이상, 이용약관, 개인정보 수집·이용) + 선택(마케팅). `user_consents`에 항목·버전(시행일)·동의 여부 기록. `/terms`·`/privacy` 초안 — **노란 표시(〔 〕) 항목을 채우고 검토한 뒤 머지**(사업자 정보, 환불 기준, 리전, 정산·원천징수 방침).
13. 비밀번호 재설정: 30분·1회용 링크, DB에는 토큰 해시만, 계정 유무와 무관한 동일 응답, 성공 시 모든 세션 종료. 메일은 Resend HTTP API.
    - **발송 수단 제안**: 정식 도메인 구매 후 **Resend**(무료 월 3,000통·일 100통, 도메인 DNS 인증 필요). `vercel.app` 주소로는 발신 도메인 인증이 안 되므로 도메인이 먼저다. 대안은 AWS SES(저렴, 초기 샌드박스 해제 신청 필요). 설정 전에는 재설정 요청이 503 "운영자에게 문의"로 안내된다.
14. **확인 결과: 사실.** 로그인 실패 401도 인터셉터가 `/login`으로 새로고침해 오류 문구가 사라졌다 → 3번에서 인증 요청은 제외해 해결, 브라우저에서 확인.
15. **확인 결과: 사실.** 상세 화면 `방문 및 예약 안내`가 코드에 고정된 문구였다 → 미션별 `visitGuide` 입력(고객사·운영자 등록 화면), 비어 있으면 숨김. 기존 미션은 숨겨진다.
16. 상세 "키워드 정보"를 고객사가 고른 메인·서브 키워드로(검색량 등 내부 수치는 비공개), 없으면 숨김. 고정 `#맘브릿지 #체험단` 태그 제거.
17. **확인 결과: 사실(코드 기준).** 미션 지역이 자유 입력("예: 서울시")이고 필터는 완전 일치라 '충청북도'로 거르면 '충북'·'청주시'로 저장된 미션이 빠진다 → 시·도 정식 명칭 목록으로 저장(입력은 선택 상자, '충북'→'충청북도' 정규화, 시·도 칸에 시 이름은 거절), 필터는 예전 표기까지 검색. 시 이름이 시·도 칸에 들어간 기존 행은 3-4로 정리.
18. `npm run missions:cleanup` — `list` / `hide --ids`(목록에서 내리고 종료, 되돌릴 수 있음) / `delete --ids | --unpaid-drafts <일수>`(결제·제출 기록이 있으면 거부). `--apply` 없이는 미리 보기, `--apply`는 대상 DB 주소를 보여 주고 동작 이름 입력을 받는다.
19. 본인 클릭 제외: 로그인한 체험단원 브라우저에 서명된 값을 `/r` 경로 전용 쿠키(`mb_self`)로 저장, 추적 링크 주인과 같으면 집계하지 않음(이동은 그대로). 로그아웃 시 삭제. 운영 설정 `click.excludeSelf`(기본 true)로 끌 수 있다. 다른 기기·로그아웃 상태 클릭은 구분할 수 없어 집계된다.

## 3. 운영 DB 적용 계획 (머지 전에 확인)

머지하면 Render 빌드의 `migrate deploy`가 자동 적용한다. 적용 전 **DB backup 워크플로 또는 PC에서 `pg_dump` 백업**을 먼저 받는다. 아래 SQL은 Supabase SQL Editor에서 실행하는 읽기 전용 확인이다(3-4·3-5의 변경 문은 결과를 보고 별도로 확정).

### 3-1. RLS (`fix/enable-rls-all-tables`)
```sql
-- 적용 전: RLS가 꺼진 테이블 — 새 테이블 8개만 나와야 한다
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1;
-- 테이블 소유자가 앱 접속 역할(postgres)인지
select tablename, tableowner from pg_tables where schemaname = 'public' order by 1;
```
- 8개가 아닌 다른 테이블이 나오거나 소유자가 `postgres`가 아니면 적용하지 말고 공유.
- 적용 후: Security Advisor 오류 0건, 앱 로그인·미션 목록·추적 링크 동작 확인.
- 되돌리기(필요 시): `ALTER TABLE <이름> DISABLE ROW LEVEL SECURITY;`

### 3-2. 인증 스택 (컬럼 `users."tokenVersion"`, 테이블 `password_reset_tokens`·`user_consents`)
```sql
-- 대소문자만 다른 중복 이메일 (있으면 로그인 시 어느 계정이 잡힐지 불명확 → 먼저 정리)
select lower(email), count(*) from users group by 1 having count(*) > 1;
```
- `ADD COLUMN ... DEFAULT 0`은 PostgreSQL 11+에서 테이블을 다시 쓰지 않는다. 새 테이블은 RLS를 켠 채 만들어진다.
- 배포 직후 기존 로그인 사용자는 그대로 유지된다(버전 없는 리프레시 토큰 = 0).
- 동의 필수화는 **백엔드·프론트가 같은 PR**이라 함께 배포되지만, Render가 먼저 뜨고 Vercel이 늦으면 그 몇 분 동안 이전 화면에서의 가입은 400("약관 동의가 필요합니다")이 된다.

### 3-3. 모집 마감 자동 전환 (`feat/auto-close-expired-missions`)
머지 후 첫 일 배치(03:30)에서 아래 미션의 상태가 바뀐다. 미리 확인:
```sql
select m.id, m.title, m."endDate",
       (select count(*) from applications a where a."missionId" = m.id and a.status in ('APPROVED','PENDING')) as active_apps
from missions m
where m.status = 'OPEN'
  and m."endDate" < (date_trunc('day', now() at time zone 'Asia/Seoul') - interval '9 hours')
order by m."endDate";
```
- `active_apps > 0` → IN_PROGRESS, `0` → CLOSED. 데모 미션 3개(9/25, 10/1, 10/11 마감)는 지원자가 없으면 CLOSED가 된다.
- 결과가 예상과 다르면(진행 중이어야 할 미션이 CLOSED로 갈 예정 등) 머지 전에 공유.

### 3-4. 지역 데이터 정리 (`fix/region-filter` 머지 후)
```sql
select "regionSi", "regionGu", count(*) from missions group by 1, 2 order by 3 desc;
```
- '서울시'·'충북' 같은 시·도 별칭은 필터가 찾으므로 그대로 둬도 된다.
- 시·도 칸에 시 이름이 들어간 행(예: '청주시')은 결과를 보고 행별 변경 문을 확정한다. 형태 예:
  ```sql
  -- 예시 — 실행 전 대상 확인 필수
  update missions set "regionGu" = trim("regionSi" || ' ' || coalesce("regionGu", '')), "regionSi" = '충청북도'
  where "regionSi" = '청주시';
  ```

### 3-5. 데모·임시 미션 정리 (`feat/mission-cleanup-script` 머지 후, PC에서)
```powershell
cd C:\Mombridge\backend; npm.cmd ci; npm.cmd run build
$env:DATABASE_URL = "<Session pooler 주소>"; $env:JWT_ACCESS_SECRET = "x"; $env:JWT_REFRESH_SECRET = "x"
npm.cmd run missions:cleanup -- list
npm.cmd run missions:cleanup -- hide --ids <데모 미션 id,id>          # 미리 보기
npm.cmd run missions:cleanup -- hide --ids <데모 미션 id,id> --apply  # 실행 (hide 입력)
npm.cmd run missions:cleanup -- delete --unpaid-drafts 14              # 결제 안 된 임시저장 미리 보기
Remove-Item Env:DATABASE_URL, Env:JWT_ACCESS_SECRET, Env:JWT_REFRESH_SECRET
```
- `JWT_*`는 스크립트가 공통 설정을 읽기 때문에 필요한 자리 채움 값이다(토큰을 만들지 않음).
- 데모 미션은 `hide`(되돌릴 수 있음)를 권장. `list` 결과를 먼저 공유해 주시면 대상 id를 함께 확인한다.

## 4. 머지 후 설정할 것

| 대상 | 항목 | 언제 |
|---|---|---|
| GitHub Actions | DB 백업: secrets `BACKUP_DATABASE_URL`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` / variable `BACKUP_GPG_PUBLIC_KEY` — 절차는 [db-backup-restore.md](../ops/db-backup-restore.md) | 백업 PR 머지 후, 첫 수동 실행 + 복원 연습 1회 |
| Render | `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production` | 모니터링 PR 머지 후 |
| Vercel | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` (Production) → Redeploy | 같음 |
| Render | `RESEND_API_KEY`, `MAIL_FROM` | 정식 도메인·Resend 인증 후 |
| Render | `CORS_ORIGIN` 정리 (2절 10번) | 아무 때나 |
| 외부 모니터 | `https://mombridge-backend.onrender.com/health/ready` 5분 간격 | health PR 머지 후 |

## 5. 남은 확인 (6차에서 이어짐)
- Daily jobs 수동 실행, 실제 추적 링크 클릭 테스트, 서버 쪽 블로그 점검(`--server`), Render 플랜 검토(Free).
- 오픈 전: 약관·방침 채우기·검토, 정식 도메인(추적 링크·메일 발신), 정산 방침 확정([business-model.md](business-model.md)).
