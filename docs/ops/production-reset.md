# 운영 오픈 전 데이터 초기화 — 검토 메모

운영 전에 시험용 데이터를 지우고 운영자 계정만 남기려 할 때의 절차를 정리한다.
**이 문서는 계획만 담는다. 여기 적힌 명령을 실행한 적은 없다.**

관련 문서: [db-backup-restore.md](./db-backup-restore.md) · 정리 스크립트 `backend/src/scripts/cleanup-missions.ts`

---

## 1. 지금 있는 정리 스크립트로 충분한가 — 아니다

`npm run missions:cleanup`(#24)은 **미션만** 다룬다. 기본이 미리 보기이고 `--apply`를 붙여야 실제로 바뀌며, 결제·제출 기록이 있는 미션은 삭제를 거부한다. 운영 전 정리에 쓰기에는 좋은 안전장치지만, 범위가 좁다.

| 대상 | 정리 스크립트가 다루는가 |
|---|---|
| 미션 (숨김·삭제) | 다룬다 |
| 지원·제출·정산 | 다루지 않는다 (오히려 있으면 미션 삭제를 막는다) |
| 회원(고객사·체험단원) | 다루지 않는다 |
| 커뮤니티 글·댓글·공감 | 다루지 않는다 |
| 추적 링크·클릭 기록·일 집계 | 다루지 않는다 |
| 알림·동의 기록·비밀번호 재설정 토큰 | 다루지 않는다 |
| 운영 설정(`platform_settings`) | 다루지 않는다 |
| 미션 사진(저장소 파일) | 다루지 않는다 |

**결론: 운영자 계정만 남기는 전체 초기화에는 별도 절차가 필요하다.** 미션 몇 건만 걷어낼 때는 기존 스크립트로 충분하다.

---

## 2. 안전한 순서 — 백업 → 초기화 → 확인

### 2-1. 백업 (되돌릴 수 있는 지점 만들기)

1. `DB backup` 워크플로를 **수동 실행**(`workflow_dispatch`)해 그날 백업을 만든다.
2. 백업 파일이 저장소(R2)에 올라왔는지, 크기가 0이 아닌지 확인한다.
3. **복원을 한 번 해 본다.** 백업은 복원해 보기 전까지 백업이 아니다. 빈 DB를 하나 만들어 복원하고 테이블 수와 `users` 행 수를 확인한다.
4. 복호화 키(`mombridge-backup-SECRET.asc`)가 손에 있는지 확인한다. 이게 없으면 백업은 쓸모가 없다.

### 2-2. 남길 것을 먼저 적어 둔다

```sql
-- 남길 운영자 계정 (실행 전에 눈으로 확인)
SELECT id, email, name FROM users WHERE role = 'OPERATOR' AND "isActive";
```

이 `id` 목록을 메모해 둔다. 아래 모든 삭제는 이 목록을 기준으로 한다.

### 2-3. 삭제 순서

스키마에 `onDelete: Cascade`가 걸린 곳이 많아 사실상 **회원을 지우면 그 아래가 함께 지워진다.** 다만 순서를 지키면 외래 키 오류 없이, 그리고 중간에 멈춰도 상태를 알 수 있다.

> 아래는 **계획**이다. 실제로는 한 트랜잭션으로 묶고, 각 단계 뒤에 건수를 찍어 확인하면서 진행한다.

1. **저장소 파일 먼저** — DB를 지우면 `mission_images.storagePath`를 잃어 버려 버킷에 고아 파일이 남는다.
   ```sql
   SELECT "storagePath" FROM mission_images;   -- 목록을 받아 두고 버킷에서 지운다
   ```
   또는 버킷 `mission-images`를 통째로 비운다(운영 데이터가 없으므로 안전).

2. **집계·로그성 자료** — 다른 것에 딸려 있지 않아 먼저 지워도 된다.
   `click_events` → `click_daily_visitors` → `click_daily_stats` → `notifications` → `password_reset_tokens`

3. **미션에 딸린 것** — `submissions` → `payouts` → `applications` → `tracking_links` → `report_share_links` → `mission_keywords` → `mission_tags` → `mission_images` → `bookmarks`

4. **미션** — `missions`

5. **커뮤니티** — `post_likes` → `post_comments` → `posts`

6. **회원** — 운영자만 남긴다.
   ```sql
   DELETE FROM users
   WHERE id NOT IN (<2-2에서 적어 둔 운영자 id 목록>);
   ```
   `client_profiles` · `participant_profiles` · `operator_profiles` · `user_consents` · `sns_accounts`는 `users`에 `Cascade`로 걸려 있어 함께 지워진다.

7. **설정은 남긴다** — `platform_settings`는 운영 기준값(클릭 한도, 대가 표시 문구 등)이라 지우지 않는다. 시험하며 바꾼 값이 있으면 개별로 되돌린다.

8. **마이그레이션 기록은 절대 건드리지 않는다** — `_prisma_migrations`를 지우면 다음 배포에서 마이그레이션이 다시 돌아 깨진다.

### 2-4. 확인

```sql
-- 운영자만 남았는지
SELECT role, count(*) FROM users GROUP BY role;

-- 비어 있어야 하는 표
SELECT 'missions' t, count(*) FROM missions
UNION ALL SELECT 'applications', count(*) FROM applications
UNION ALL SELECT 'submissions', count(*) FROM submissions
UNION ALL SELECT 'payouts', count(*) FROM payouts
UNION ALL SELECT 'posts', count(*) FROM posts
UNION ALL SELECT 'click_events', count(*) FROM click_events
UNION ALL SELECT 'mission_images', count(*) FROM mission_images
UNION ALL SELECT 'bookmarks', count(*) FROM bookmarks;

-- 남아 있어야 하는 것
SELECT count(*) FROM platform_settings;
SELECT count(*) FROM _prisma_migrations;
```

그리고 화면에서:

- 운영자 계정으로 로그인된다
- `/missions`가 "우리 동네 미션을 준비하고 있어요"로 비어 보인다
- 관리자 개요의 숫자가 모두 0이다
- 저장소 버킷에 남은 파일이 없다

---

## 3. 주의할 점

- **운영 DB 주소를 두 번 확인한다.** `DATABASE_URL`의 host를 눈으로 보고 시작한다. 정리 스크립트가 host를 찍어 주는 것도 같은 이유다.
- **한 번에 하지 말고 단계마다 건수를 확인한다.** 중간에 멈춰도 어디까지 됐는지 알 수 있다.
- **지운 뒤에는 백업을 한 번 더 받는다.** 초기화된 상태가 새 기준점이 된다.
- 운영자 계정의 비밀번호는 초기화와 무관하게 오픈 전에 한 번 바꾸는 편이 좋다.

---

## 4. 아직 정하지 않은 것

- 이 절차를 스크립트로 만들지(예: `npm run db:reset -- --apply`), SQL을 손으로 돌릴지. 한 번만 쓸 작업이면 손으로 하는 편이 통제하기 쉽다.
- 운영자 계정을 **새로 만들고** 기존 것까지 모두 지울지. 그렇다면 `scripts/create-operator.ts`로 먼저 만들고 그 id만 남긴다.
