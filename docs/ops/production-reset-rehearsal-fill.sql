-- ============================================================================
-- 리허설 전용 — 임시 복사본 DB에만 넣는 가짜 행.
-- 로컬 개발 DB에는 정산·추적·클릭·감사 기록 등이 0건이라, 그대로 리허설하면 외래 키가 막는 경로
-- (audit_logs → users RESTRICT, payouts → submissions RESTRICT 등)를 실제로 지나가지 않는다.
-- 그래서 모든 표에 최소 한 줄씩 채워 삭제 순서가 정말 맞는지 확인한다.
--
-- production-reset-rehearsal.sh가 임시 DB 이름을 확인한 뒤에만 이 파일을 돌린다. 운영·원래 로컬 DB에 쓰지 않는다.
-- ============================================================================
\set ON_ERROR_STOP on
-- 파일이 UTF-8이다. 윈도 psql은 기본 인코딩(UHC)으로 읽어 한글에서 멈추므로 먼저 맞춘다
\encoding UTF8
BEGIN;

DO $$
BEGIN
  IF current_database() NOT LIKE 'mombridge_reset_rehearsal_%' THEN
    RAISE EXCEPTION '리허설 임시 DB가 아닙니다 (%). 가짜 행을 넣지 않습니다.', current_database();
  END IF;
END $$;

-- 남겨야 하는 것도 하나씩 있어야 '남는지' 확인이 의미가 있다
INSERT INTO tags (id, name) VALUES (gen_random_uuid(), '리허설 태그');
INSERT INTO platform_settings (key, value, "updatedBy", "updatedAt")
  SELECT 'rehearsal.setting', '{"v": 1}'::jsonb, (SELECT id FROM users WHERE role = 'OPERATOR' LIMIT 1), now();

-- 미션에 딸린 것
INSERT INTO mission_tags ("missionId", "tagId")
  SELECT (SELECT id FROM missions ORDER BY "createdAt" LIMIT 1), (SELECT id FROM tags WHERE name = '리허설 태그');
INSERT INTO mission_images (id, "missionId", url, "storagePath")
  SELECT gen_random_uuid(), m.id, 'https://example.invalid/' || m.id || '/a.webp', m.id || '/rehearsal-a.webp'
  FROM (SELECT id FROM missions ORDER BY "createdAt" LIMIT 2) m;
INSERT INTO mission_keywords (id, "missionId", keyword, role)
  SELECT gen_random_uuid(), (SELECT id FROM missions ORDER BY "createdAt" LIMIT 1), '리허설 키워드', 'MAIN';
INSERT INTO report_share_links (id, "missionId", "tokenHash", "createdBy", "expiresAt")
  SELECT gen_random_uuid(), (SELECT id FROM missions ORDER BY "createdAt" LIMIT 1), repeat('a', 64),
         (SELECT id FROM users WHERE role = 'CLIENT' LIMIT 1), now() + interval '7 days';

-- 지원 → 추적 링크 → 클릭
INSERT INTO tracking_links (id, code, "applicationId", "missionId", "participantId")
  SELECT gen_random_uuid(), 'rehearsal' || row_number() OVER (), a.id, a."missionId", a."participantId"
  FROM (SELECT * FROM applications ORDER BY "createdAt" LIMIT 2) a;
INSERT INTO click_events ("linkId", "dayKey", device, "isBot", "isUnique")
  SELECT id, current_date, 'MOBILE', false, true FROM tracking_links WHERE code LIKE 'rehearsal%';
INSERT INTO click_daily ("linkId", "dayKey", "updatedAt")
  SELECT id, current_date, now() FROM tracking_links WHERE code LIKE 'rehearsal%';
INSERT INTO click_daily_visitors ("linkId", "dayKey", "visitorHash")
  SELECT id, current_date, repeat('b', 64) FROM tracking_links WHERE code LIKE 'rehearsal%';

-- 제출 → 정산 (payouts → submissions RESTRICT)
INSERT INTO payouts (id, "submissionId", "participantId", amount, "platformFee", "netAmount", "updatedAt")
  SELECT gen_random_uuid(), s.id, s."participantId", 30000, 3000, 27000, now()
  FROM (SELECT * FROM submissions ORDER BY "createdAt" LIMIT 2) s;

-- 찜
INSERT INTO bookmarks (id, "participantId", "missionId")
  SELECT gen_random_uuid(), (SELECT id FROM participant_profiles LIMIT 1), (SELECT id FROM missions ORDER BY "createdAt" LIMIT 1);

-- 커뮤니티 댓글·공감 (참여자와 운영자 모두)
INSERT INTO community_comments (id, "postId", "userId", content)
  SELECT gen_random_uuid(), (SELECT id FROM community_posts LIMIT 1), u.id, '리허설 댓글'
  FROM users u WHERE u.role IN ('PARTICIPANT', 'OPERATOR');
INSERT INTO community_likes ("postId", "userId")
  SELECT (SELECT id FROM community_posts LIMIT 1), u.id FROM users u WHERE u.role IN ('PARTICIPANT', 'OPERATOR');

-- 회원에 딸린 기록 — 운영자 것도 하나씩 (운영자 것이 남거나 지워지는지 보려고)
INSERT INTO notifications (id, "userId", type, title, body, "resourceType")
  SELECT gen_random_uuid(), u.id, 'MISSION_OPEN', '마포구에 새 미션이 열렸어요', '[리허설] 새 미션 알림', 'mission'
  FROM users u WHERE u.role IN ('PARTICIPANT', 'OPERATOR');
INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt")
  SELECT gen_random_uuid(), (SELECT id FROM users WHERE role = 'PARTICIPANT' LIMIT 1), repeat('c', 64), now() + interval '1 hour';
INSERT INTO keyword_cache ("cacheKey", source, response, "fetchedAt", "expiresAt")
  VALUES ('rehearsal:key', 'mock', '{}'::jsonb, now(), now() + interval '1 day');

-- 감사 기록: 가게가 미션을 고친 기록(이것 때문에 가게 회원 삭제가 막힌다) + 운영자 기록
INSERT INTO audit_logs (id, "actorId", action, "targetTable", "targetId")
  SELECT gen_random_uuid(), (SELECT id FROM users WHERE role = 'CLIENT' LIMIT 1), 'MISSION_UPDATE', 'missions',
         (SELECT id FROM missions ORDER BY "createdAt" LIMIT 1);
INSERT INTO audit_logs (id, "actorId", action, "targetTable", "targetId")
  SELECT gen_random_uuid(), (SELECT id FROM users WHERE role = 'OPERATOR' LIMIT 1), 'PAYOUT_ACCOUNT_VIEW', 'payouts',
         (SELECT id FROM payouts LIMIT 1);

-- SNS 계정 (참여자 프로필에 CASCADE) — 로컬에는 0건이라 하나 넣는다
INSERT INTO sns_accounts (id, "profileId", platform, handle, url, "updatedAt")
  SELECT gen_random_uuid(), p.id, 'NAVER_BLOG', 'rehearsal', 'https://blog.naver.com/rehearsal', now()
  FROM participant_profiles p JOIN users u ON u.id = p."userId" AND u.role = 'PARTICIPANT' LIMIT 1;

-- 1단계에서 늘어난 칸에도 값을 넣어 둔다
UPDATE participant_profiles SET "newMissionAlerts" = true;
UPDATE missions SET "openAlertedAt" = now() WHERE status = 'OPEN';

COMMIT;
\echo '리허설용 가짜 행을 넣었습니다.'
