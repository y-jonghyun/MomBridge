# 운영 오픈 전 데이터 초기화

운영 전에 시험용 데이터를 모두 지우고 **운영자 계정 · 운영 설정 · 태그 · 마이그레이션 기록**만 남기는 절차.
**운영 DB에서 실행한 적은 아직 없다.** 로컬 복사본 리허설만 했다(아래 8절).

| 파일 | 역할 |
|---|---|
| [`production-reset.sql`](./production-reset.sql) | 초기화 SQL. **한 트랜잭션** — 어느 단계든 실패하거나 확인이 어긋나면 아무것도 지워지지 않는다. 기본은 미리 보기(ROLLBACK) |
| [`production-reset-rehearsal.sh`](./production-reset-rehearsal.sh) | 로컬 DB를 임시 DB로 복사해 SQL을 실제로 돌려 보는 리허설 (로컬 주소만 받는다) |
| [`production-reset-rehearsal-fill.sql`](./production-reset-rehearsal-fill.sql) | 리허설 임시 DB에만 넣는 가짜 행 (모든 표를 한 줄 이상 채워 외래 키 경로를 실제로 지나가게) |

관련: [db-backup-restore.md](./db-backup-restore.md) (백업·복원) · 미션 몇 건만 걷어낼 때는 `npm run missions:cleanup`으로 충분하다(미션만 다룬다).

---

## 1. 무엇을 지우고 무엇을 남기나

### 남기는 것 (SQL이 끝에서 개수가 그대로인지 확인하고, 다르면 전체를 되돌린다)
| 표 | 이유 |
|---|---|
| `users` 중 `role = 'OPERATOR'` (활성·비활성 모두) | 운영자 계정. 하나도 없으면 SQL이 시작하지 않는다 |
| `operator_profiles`, 운영자의 `user_consents` | 운영자 계정에 딸린 것 |
| `platform_settings` | 운영 기준값(클릭 한도, 대가 표시 문구 등). 시험하며 바꾼 값은 따로 되돌린다 |
| `tags` | 태그 이름 목록 (`mission_tags` 연결만 지운다) |
| `_prisma_migrations` | **절대 지우지 않는다** — 지우면 다음 배포에서 마이그레이션이 다시 돌아 깨진다 |
| `audit_logs` 중 운영자 기록 | `audit=keep_operator`를 고른 경우만 (5절) |

### 지우는 것 — 순서는 외래 키에서 정했다
2026-11-13 로컬 DB(마이그레이션 16개, 운영과 같은 스키마)의 `information_schema`에서 외래 키와 삭제 규칙을 읽어 정했다.
**RESTRICT**는 자식이 남아 있으면 부모를 지울 수 없다는 뜻이고, **CASCADE**는 부모를 지우면 함께 지워진다는 뜻이다.
CASCADE로 함께 지워지는 표도 SQL에서는 먼저 직접 지운다 — 표마다 건수를 분명히 보려고.

| 순서 | 표 | 막는 외래 키 (그래서 이 순서) |
|---|---|---|
| 1 | `click_events`, `click_daily`, `click_daily_visitors` | `tracking_links`에 CASCADE / 외래 키 없음 |
| 2 | `payouts` | `payouts → submissions` **RESTRICT**, `payouts → participant_profiles` **RESTRICT** |
| 3 | `submissions` | `→ applications` **RESTRICT**, `→ missions` **RESTRICT**, `→ participant_profiles` **RESTRICT** |
| 4 | `tracking_links` | `→ applications`·`missions` CASCADE |
| 5 | `applications` | `→ missions` **RESTRICT**, `→ participant_profiles` **RESTRICT** |
| 6 | `bookmarks`, `mission_images`, `mission_keywords`, `mission_tags`, `report_share_links` | `→ missions` CASCADE. **`mission_images`의 저장소 파일 목록은 실행 전에 받아 둔다** (3-3) |
| 7 | `missions` (1단계에서 늘어난 `openAlertedAt` 칸 포함) | `missions → client_profiles` **RESTRICT** |
| 8 | `community_likes`, `community_comments`, `community_posts` (운영자 글 포함) | `→ community_posts` CASCADE |
| 9 | `notifications` (1단계 새 미션 알림 `MISSION_OPEN` 포함, 운영자 것도), `password_reset_tokens`, `keyword_cache` | `→ users` CASCADE / `keyword_cache`는 외래 키 없음 |
| 10 | `audit_logs` — 전부 또는 운영자 것만 남기고 (5절) | **`audit_logs → users` RESTRICT** — 가게가 미션을 고치면 `MISSION_UPDATE` 기록이 남는다. 이걸 먼저 지우지 않으면 회원 삭제가 막힌다 |
| 11 | `participant_profiles` (1단계 `newMissionAlerts` 칸 포함), `client_profiles` — **운영자 것도** | `client_profiles`는 7번(`missions`) 뒤라야 지울 수 있다. `sns_accounts`는 CASCADE |
| 12 | `users` 중 운영자가 아닌 계정 | `user_consents`·`operator_profiles`는 CASCADE |

> **운영자 계정의 참여자·가게 프로필도 지우는 이유:** 내 활동(`/participant`)과 가게 화면(`/client`)은 들어온 사람의 프로필을
> 없으면 만든다. 운영자가 화면을 둘러보면 운영자 계정에도 프로필이 생긴다(로컬 사본에서 실제로 확인). 남겨 두면 운영자 화면의
> 가게 목록에 운영자 자신이 '가게'로 보인다. 운영자 계정에 필요한 것은 `operator_profiles`뿐이다.
>
> **SET NULL:** `applications.reviewerId`, `submissions.reviewerId`·`disclosureConfirmedById`는 운영자 프로필을 가리키지만
> 운영자 프로필은 지우지 않으므로 영향이 없다. `platform_settings.updatedBy`는 외래 키가 없는 기록용 칸이다.

### 저장소 버킷 (`mission-images`)
미션 사진만 저장소에 올라간다(백엔드 `SUPABASE_STORAGE_BUCKET`, 기본 `mission-images`). 파일 이름은 `<미션 id>/<시각>-<무작위>.webp`.
프로필 사진은 저장소에 올리지 않는다. 지우는 순서는 4절.

---

## 2. 실행 전 준비

### 2-1. 접속 주소 확인
- `DIRECT_URL` = Supabase **Session pooler(5432) 또는 직접 연결**. Transaction pooler(6543)는 쓰지 않는다(트랜잭션이 보장되지 않는다).
- 주소의 **host와 DB 이름을 눈으로 확인**한다. 운영 Supabase의 DB 이름은 보통 `postgres`다. SQL은 `expected_db`로 받은 이름과
  접속한 DB 이름이 다르면 시작하지 않는다.
- 윈도에서는 `psql`의 옵션을 **접속 주소보다 앞에** 둔다(주소 뒤의 옵션은 무시된다). SQL 파일이 UTF-8이라 파일 첫머리에서
  `\encoding UTF8`로 맞춘다.

### 2-2. 백업 → 복원 연습 (되돌릴 지점)
1. Actions → **DB backup** → Run workflow로 그날 백업을 만든다.
2. 백업 파일이 R2에 올라왔고 크기가 0이 아닌지 본다.
3. [db-backup-restore.md 2절](./db-backup-restore.md)대로 **로컬 빈 DB에 복원해 본다**. `users`·`_prisma_migrations` 행 수가 맞는지 확인.
4. 복호화 키(`mombridge-backup-SECRET.asc`)와 암호가 손에 있는지 확인한다. 없으면 백업은 쓸모가 없다.

### 2-3. 남길 운영자와 지울 저장소 파일 목록 받기 (읽기만)
```bash
psql -X -v ON_ERROR_STOP=1 -c "SELECT id, email, name, \"isActive\" FROM users WHERE role = 'OPERATOR' ORDER BY email" "$DIRECT_URL"
psql -X -v ON_ERROR_STOP=1 -c "\copy (SELECT \"storagePath\" FROM mission_images ORDER BY 1) TO 'mission-images-to-delete.txt'" "$DIRECT_URL"
```
- 운영자 목록이 기대와 다르면 멈춘다(예: 남기고 싶은 운영자가 없다, 비활성 운영자를 지우고 싶다 → 9절).
- 파일 목록은 4절에서 버킷을 비운 뒤 확인용으로 쓴다. DB를 지우면 `storagePath`를 잃으므로 **반드시 먼저** 받는다.

### 2-4. 로컬 리허설
```bash
SOURCE_URL='postgresql://…@localhost:5433/mombridge_db' bash docs/ops/production-reset-rehearsal.sh
```
로컬 DB를 임시 DB 두 개(`mombridge_reset_rehearsal_all`, `…_keep_operator`)로 복사해 아래를 차례로 확인하고 지운다.
원래 DB에는 읽기만 한다(끝에서 표별 행 수가 전후 같은지도 확인). 결과는 8절.

---

## 3. 운영에서 실행

### 3-1. 미리 보기 (아무것도 지우지 않는다)
```bash
psql -X -v ON_ERROR_STOP=1 -v expected_db=postgres -v audit=all -v apply=false \
  -f docs/ops/production-reset.sql "$DIRECT_URL"
```
남길 운영자 목록, 표별 전/후 행 수, `확인 통과: …`가 나오고 마지막에 `미리 보기였습니다 (ROLLBACK)`가 나와야 한다.
표의 '후' 숫자가 기대와 다르면 여기서 멈춘다.

### 3-2. 적용
```bash
psql -X -v ON_ERROR_STOP=1 -v expected_db=postgres -v audit=all -v apply=true \
  -f docs/ops/production-reset.sql "$DIRECT_URL"
```
`적용했습니다 (COMMIT)`가 나오면 끝. 오류가 나면 그 자리에서 멈추고 **아무것도 지워지지 않는다**(7절).
`audit`은 5절에서 고른 값을 쓴다.

---

## 4. 저장소 파일 지우기 — DB를 지운 **뒤에**
순서를 DB 다음으로 두는 이유: DB 트랜잭션이 실패하면 미션이 그대로 남는데, 파일을 먼저 지웠다면 그 미션들의 사진이 깨진다.
반대로 DB를 지운 뒤 파일 삭제가 실패하면 버킷에 고아 파일만 남고 화면에는 영향이 없다 — 다시 하면 된다.

1. Supabase 대시보드 → Storage → `mission-images` → **Empty bucket** (버킷 자체는 지우지 않는다. 앱이 이 버킷에 올린다).
   운영 데이터가 아직 없으므로 통째로 비워도 안전하다. 2-3의 목록에 없던 파일(예전에 DB에서 빠진 고아 파일)까지 함께 지워진다.
2. 버킷이 비었는지 확인한다(파일 0개).

---

## 5. `audit_logs` — 두 가지 중 하나를 고른다 (아직 정하지 않음)
`audit_logs.actorId → users`가 RESTRICT라서, 운영자가 아닌 회원을 지우려면 그 회원들이 남긴 기록은 어느 쪽이든 지워야 한다.
차이는 **운영자가 남긴 기록**(정산 계좌 열람 `PAYOUT_ACCOUNT_VIEW`, 설정 변경 `SETTING_UPDATE`, 가게 등록 `OPERATOR_CLIENT_*` 등)을 남기느냐다.

| 선택 | 실행 값 | SQL이 하는 일 |
|---|---|---|
| 모두 지움 | `-v audit=all` | `DELETE FROM audit_logs;` |
| 운영자 기록만 남김 | `-v audit=keep_operator` | `DELETE FROM audit_logs WHERE "actorId" NOT IN (SELECT id FROM users WHERE role = 'OPERATOR');` |

- 남긴 운영자 기록의 `targetId`는 지워진 미션·정산 등을 가리키게 된다(외래 키가 없어 오류는 없다).
- 시험 데이터에 대한 기록이라 모두 지워도 되고, '누가 언제 계좌를 봤는지'를 오픈 전 것까지 보관하려면 남긴다.

---

## 6. 실행 후 확인 (순서대로)
1. **표별 남은 행 수** — 3-2 출력의 '후' 열. SQL이 이미 확인했지만 한 번 더 본다:
   ```sql
   SELECT role, count(*) FROM users GROUP BY role;              -- OPERATOR만
   SELECT 'missions' t, count(*) FROM missions
   UNION ALL SELECT 'applications', count(*) FROM applications
   UNION ALL SELECT 'submissions', count(*) FROM submissions
   UNION ALL SELECT 'payouts', count(*) FROM payouts
   UNION ALL SELECT 'community_posts', count(*) FROM community_posts
   UNION ALL SELECT 'notifications', count(*) FROM notifications
   UNION ALL SELECT 'click_events', count(*) FROM click_events
   UNION ALL SELECT 'mission_images', count(*) FROM mission_images
   UNION ALL SELECT 'participant_profiles', count(*) FROM participant_profiles
   UNION ALL SELECT 'client_profiles', count(*) FROM client_profiles
   UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;     -- all이면 0, keep_operator면 운영자 기록 수
   SELECT count(*) FROM platform_settings;   -- 실행 전과 같아야
   SELECT count(*) FROM tags;                -- 실행 전과 같아야
   SELECT count(*) FROM _prisma_migrations;  -- 실행 전과 같아야
   ```
2. **저장소** — `mission-images` 버킷 파일 0개.
3. **운영자 로그인** — 운영자 계정으로 로그인되고, 운영자 화면의 숫자가 모두 0이다. `/missions`가 출시 첫날 빈 화면으로 보인다.
4. **가입부터 정산 기록까지 한 번** (운영에서, 시험용 계정으로):
   1. 참여자로 가입 → 활동 지역·SNS 채우기 → '새 미션 알림 받기' 켜기
   2. 운영자: 가게 등록(대행) → 미션 등록 → 모집 중으로 바꾸기 → 참여자 알림함에 새 미션 알림이 왔는지
   3. 참여자: 신청 → 운영자: 선정 → 참여자: 후기 링크 제출
   4. 운영자: 승인 → **정산 기록(payouts)이 생겼는지**(지급액 = 보상금 − 수수료 10%)
5. 4번에서 만든 시험 데이터는 **3절을 한 번 더**(미리 보기 → 적용) 돌려 지운다. 두 번 돌려도 안전하다(리허설 6단계).
6. **새 백업** — 초기화된 상태를 새 기준점으로 Actions → DB backup을 한 번 더 돌린다.
7. 운영자 계정 비밀번호를 오픈 전에 한 번 바꾼다(초기화와 무관하게 권장).

---

## 7. 실패했을 때
| 상황 | 상태 | 할 일 |
|---|---|---|
| SQL이 중간에 오류로 멈춤 (외래 키, 확인 실패, 접속 끊김 등) | **아무것도 지워지지 않았다** (한 트랜잭션, ON_ERROR_STOP) | 오류 문구를 보고 원인을 고친 뒤 3-1 미리 보기부터 다시 |
| `expected_db`가 다르다고 멈춤 | 시작도 안 했다 | 접속 주소와 DB 이름을 다시 확인 |
| 적용(COMMIT)은 됐는데 남겨야 할 것을 지웠다는 걸 알았다 | 지워졌다 | 2-2의 백업으로 복원: [db-backup-restore.md 3절](./db-backup-restore.md) — 가능하면 **새 Supabase 프로젝트에 복원**하고 Render `DATABASE_URL`·`DIRECT_URL`만 바꾼다(기존 DB를 보존). 운영 DB에 직접 복원할 때는 `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --schema=public` |
| 저장소 비우기가 일부만 됐다 | DB는 이미 비었고 화면은 정상 | 4절을 다시 한다 (고아 파일은 화면에 영향이 없다) |
| 파일을 지웠는데 DB를 되돌려야 한다 | 사진 파일은 백업에 없다 | DB만 복원되고 사진은 깨진다 — 그래서 저장소는 DB **뒤에** 지운다. 운영 데이터가 없는 지금은 영향이 없다 |

---

## 8. 리허설 결과 (2026-11-13, 로컬)
`production-reset-rehearsal.sh` — 로컬 개발 DB(운영에서 옮긴 시험 데이터 + 화면 확인용 계정)를 임시 DB로 복사하고,
`production-reset-rehearsal-fill.sql`로 비어 있던 표(정산·추적·클릭·감사 기록 등)를 한 줄 이상 채운 뒤 돌렸다.
**원래 로컬 DB와 운영 DB에는 실행하지 않았다.** 원래 로컬 DB의 표별 행 수는 리허설 전후 같았다.

| 단계 | `audit=all` | `audit=keep_operator` |
|---|---|---|
| 1. 가짜 행 채우기 | 29개 표 모두 1행 이상 | 같음 |
| 2. `expected_db` 틀림 | 멈춤 · 행 수 그대로 | 같음 |
| 3. 모두 지운 뒤 일부러 실패(`simulate_failure`) | 전체 되돌림 · 행 수 그대로 | 같음 |
| 4. 미리 보기(`apply=false`) | 성공 · 행 수 그대로 | 같음 |
| 5. 적용(`apply=true`) | 성공 · 확인 통과 | 성공 · 확인 통과 |
| 6. 한 번 더 적용 | 성공 · 바뀐 것 없음 | 같음 |

5단계 표별 행 수 (전 → 후). 두 경우가 `audit_logs`만 다르다.

| 표 | 전 | 후 (all) | 후 (keep_operator) |
|---|---|---|---|
| `users` | 11 | 1 | 1 |
| `operator_profiles` | 1 | 1 | 1 |
| `participant_profiles` | 7 | 0 | 0 |
| `client_profiles` | 5 | 0 | 0 |
| `sns_accounts` | 1 | 0 | 0 |
| `user_consents` | 12 | 0 | 0 |
| `missions` | 15 | 0 | 0 |
| `applications` | 14 | 0 | 0 |
| `submissions` | 11 | 0 | 0 |
| `payouts` | 2 | 0 | 0 |
| `tracking_links` | 2 | 0 | 0 |
| `click_events` · `click_daily` · `click_daily_visitors` | 2 · 2 · 2 | 0 · 0 · 0 | 0 · 0 · 0 |
| `bookmarks` · `mission_images` · `mission_keywords` · `mission_tags` · `report_share_links` | 1 · 2 · 1 · 1 · 1 | 0 | 0 |
| `community_posts` · `community_comments` · `community_likes` | 5 · 7 · 7 | 0 | 0 |
| `notifications` (새 미션 알림 포함) | 8 | 0 | 0 |
| `password_reset_tokens` · `keyword_cache` | 1 · 1 | 0 | 0 |
| `audit_logs` (가게 1 · 운영자 1) | 2 | **0** | **1** |
| `platform_settings` · `tags` · `_prisma_migrations` | 1 · 1 · 16 | 1 · 1 · 16 | 1 · 1 · 16 |

리허설에서 찾아 고친 것:
- 운영자 계정에 참여자·가게 프로필이 생겨 있어 '비어야 하는 표가 남았습니다'로 멈췄다 → 11번에 운영자 것까지 지우는 단계를 넣었다.
- 윈도 `psql`은 접속 주소 뒤의 옵션을 무시하고, 기본 인코딩(UHC)으로 한글을 읽지 못한다 → 옵션을 주소 앞에, SQL 첫머리에 `\encoding UTF8`.

리허설로 확인하지 못한 것: 저장소 버킷 비우기(로컬에 저장소가 없다), 운영자 로그인과 가입→정산 흐름(6절 3·4번, 운영에서 한다).

---

## 9. 아직 정하지 않은 것
- **`audit_logs`**: 모두 지울지, 운영자 기록만 남길지 (5절).
- **비활성 운영자 계정**: 지금 SQL은 `role = 'OPERATOR'`면 활성·비활성 모두 남긴다. 지우려면 실행 전에 따로 정한다.
- **운영자 계정을 새로 만들지**: 그렇다면 `scripts/create-operator.ts`로 먼저 만들고, 남길 운영자 목록(2-3)을 확인한 뒤 실행한다.
