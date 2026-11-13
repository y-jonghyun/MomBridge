-- ============================================================================
-- 운영 오픈 전 데이터 초기화 — 운영자 계정·운영 설정·태그·마이그레이션 기록만 남기고 모두 지운다.
-- 절차와 주의는 docs/ops/production-reset.md. 이 파일만 보고 돌리지 않는다.
--
-- 전체가 한 트랜잭션이다. 어느 단계든 실패하거나 확인이 어긋나면 RAISE로 멈추고 아무것도 지워지지 않는다.
-- 기본은 미리 보기(마지막에 ROLLBACK). apply=true를 줄 때만 COMMIT한다.
--
-- 실행 (DIRECT_URL = Supabase Session pooler 5432 또는 직접 연결. 6543 Transaction pooler는 쓰지 않는다):
--   psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 \
--     -v expected_db=postgres \        -- 접속한 DB 이름과 같아야 시작한다 (다른 DB에서 실수로 돌지 않게)
--     -v audit=all \                    -- all: 감사 기록 모두 삭제 / keep_operator: 운영자가 남긴 기록만 남김
--     -v apply=false \                  -- false: 미리 보기(되돌림) / true: 실제로 지움
--     -f docs/ops/production-reset.sql
--
-- 리허설 전용: -v simulate_failure=true 를 주면 모든 삭제를 마친 뒤 일부러 실패해 '아무것도 안 지워짐'을 확인한다.
-- ============================================================================

\set ON_ERROR_STOP on
-- 파일이 UTF-8이다. 윈도 psql은 기본 인코딩(UHC)으로 읽어 한글에서 멈추므로 먼저 맞춘다
\encoding UTF8
\if :{?expected_db}
\else
  \echo 'expected_db 변수가 없습니다. -v expected_db=<접속할 DB 이름> 을 주세요.'
  \quit
\endif
\if :{?audit}
\else
  \echo 'audit 변수가 없습니다. -v audit=all 또는 -v audit=keep_operator 를 주세요.'
  \quit
\endif
\if :{?apply}
\else
  \set apply false
\endif
\if :{?simulate_failure}
\else
  \set simulate_failure false
\endif

BEGIN;

SELECT set_config('reset.expected_db', :'expected_db', true),
       set_config('reset.audit', :'audit', true),
       set_config('reset.simulate_failure', :'simulate_failure', true);

-- ── 0. 어디에 붙었는지 · 무엇을 남기는지 ───────────────────────────────────
DO $$
BEGIN
  IF current_database() <> current_setting('reset.expected_db') THEN
    RAISE EXCEPTION '접속한 DB(%)가 expected_db(%)와 다릅니다. 멈춥니다.', current_database(), current_setting('reset.expected_db');
  END IF;
  IF current_setting('reset.audit') NOT IN ('all', 'keep_operator') THEN
    RAISE EXCEPTION 'audit 값은 all 또는 keep_operator 여야 합니다 (받은 값: %)', current_setting('reset.audit');
  END IF;
END $$;

SELECT current_database() AS db, inet_server_addr() AS server, now() AS started_at;

-- 남길 운영자 계정 (활성·비활성 모두). 실행 전에 이 목록을 눈으로 확인한다
CREATE TEMP TABLE reset_keep_users ON COMMIT DROP AS
  SELECT id, email, name, "isActive" FROM users WHERE role = 'OPERATOR';
SELECT id, email, name, "isActive" FROM reset_keep_users ORDER BY email;

DO $$
BEGIN
  IF (SELECT count(*) FROM reset_keep_users) = 0 THEN
    RAISE EXCEPTION '운영자 계정이 하나도 없습니다. 지우면 아무도 로그인할 수 없게 됩니다. 멈춥니다.';
  END IF;
END $$;

-- 표별 행 수 (전·후 비교용)
CREATE TEMP TABLE reset_counts (tbl text PRIMARY KEY, before bigint, after bigint) ON COMMIT DROP;
DO $$
DECLARE t text; n bigint;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    INSERT INTO reset_counts (tbl, before) VALUES (t, n);
  END LOOP;
END $$;

-- 남겨야 하는 것의 기준값 (끝에서 그대로인지 확인한다)
CREATE TEMP TABLE reset_keep_expect ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM reset_keep_users)                                                AS operators,
  (SELECT count(*) FROM operator_profiles WHERE "userId" IN (SELECT id FROM reset_keep_users)) AS operator_profiles,
  (SELECT count(*) FROM user_consents   WHERE "userId" IN (SELECT id FROM reset_keep_users)) AS operator_consents,
  (SELECT count(*) FROM audit_logs      WHERE "actorId" IN (SELECT id FROM reset_keep_users)) AS operator_audit_logs,
  (SELECT count(*) FROM platform_settings) AS platform_settings,
  (SELECT count(*) FROM tags)              AS tags,
  (SELECT count(*) FROM _prisma_migrations) AS prisma_migrations;

-- ── 1. 클릭·집계 (다른 표가 기대지 않는다) ───────────────────────────────────
-- click_events·click_daily는 tracking_links에 CASCADE로 걸려 있지만, 먼저 비워 건수를 분명히 한다
DELETE FROM click_events;
DELETE FROM click_daily;
DELETE FROM click_daily_visitors;        -- 외래 키 없음

-- ── 2. 정산·제출·지원 (RESTRICT 사슬: payouts → submissions → applications) ──
-- payouts.submissionId → submissions RESTRICT, payouts.participantId → participant_profiles RESTRICT
DELETE FROM payouts;
-- submissions.applicationId → applications RESTRICT, .missionId → missions RESTRICT, .participantId → participant_profiles RESTRICT
DELETE FROM submissions;
-- tracking_links → applications/missions CASCADE (먼저 지워 건수를 분명히 한다)
DELETE FROM tracking_links;
-- applications.missionId → missions RESTRICT, .participantId → participant_profiles RESTRICT
DELETE FROM applications;

-- ── 3. 미션에 딸린 것 → 미션 ───────────────────────────────────────────────
-- 아래는 모두 missions에 CASCADE지만, 미션 사진(mission_images)의 저장소 파일 목록은 이 실행 전에 따로 받아 둔다 (문서 2-3)
DELETE FROM bookmarks;
DELETE FROM mission_images;
DELETE FROM mission_keywords;
DELETE FROM mission_tags;                -- tags 자체는 남긴다
DELETE FROM report_share_links;
-- missions.clientProfileId → client_profiles RESTRICT. 1단계에서 늘어난 openAlertedAt 칸도 행과 함께 사라진다
DELETE FROM missions;

-- ── 4. 커뮤니티 (운영자가 쓴 글 포함 — 시험 글이다) ─────────────────────────
DELETE FROM community_likes;
DELETE FROM community_comments;
DELETE FROM community_posts;

-- ── 5. 회원에 딸린 기록 ─────────────────────────────────────────────────────
-- 알림: 새 미션 알림(MISSION_OPEN, 1단계)을 포함해 모두 시험 데이터에 대한 알림이다. 운영자 것도 지운다
DELETE FROM notifications;
DELETE FROM password_reset_tokens;
DELETE FROM keyword_cache;               -- 키워드 조회 캐시 (외래 키 없음)

-- 감사 기록: audit_logs.actorId → users RESTRICT. 회원을 지우기 전에 반드시 정리해야 한다
DO $$
BEGIN
  IF current_setting('reset.audit') = 'all' THEN
    DELETE FROM audit_logs;
  ELSE
    -- keep_operator: 운영자가 남긴 기록만 남긴다 (가게·참여자가 남긴 MISSION_UPDATE 등은 지운다)
    DELETE FROM audit_logs WHERE "actorId" NOT IN (SELECT id FROM reset_keep_users);
  END IF;
END $$;

-- ── 6. 참여자·가게 프로필 — 운영자 것도 지운다 ─────────────────────────────
-- 운영자 계정에도 프로필이 생겨 있을 수 있다: 내 활동(/participant)과 가게 화면(/client)은 들어오는 사람의
-- 프로필을 없으면 만든다(upsert). 운영자에게 가게 프로필이 남으면 운영자 화면의 가게 목록에 '가게'로 보인다.
-- 운영자 계정에 필요한 것은 operator_profiles뿐이다. sns_accounts는 participant_profiles에 CASCADE.
DELETE FROM participant_profiles;        -- 1단계 newMissionAlerts 칸 포함
DELETE FROM client_profiles;             -- missions가 RESTRICT로 기대므로 3단계 뒤에 지운다

-- ── 7. 회원 (운영자만 남김) ─────────────────────────────────────────────────
-- user_consents · operator_profiles는 users에 CASCADE로 함께 지워진다. 운영자의 것은 남는다
DELETE FROM users WHERE id NOT IN (SELECT id FROM reset_keep_users);

-- ── 8. 확인 — 하나라도 어긋나면 RAISE → 전체 되돌림 ───────────────────────
DO $$
DECLARE t text; n bigint;
BEGIN
  FOR t IN SELECT tbl FROM reset_counts LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    UPDATE reset_counts SET after = n WHERE tbl = t;
  END LOOP;
END $$;

SELECT tbl AS "표", before AS "전", after AS "후" FROM reset_counts ORDER BY tbl;

DO $$
DECLARE e reset_keep_expect%ROWTYPE; bad text;
BEGIN
  SELECT * INTO e FROM reset_keep_expect;

  -- 남겨야 하는 것
  IF (SELECT count(*) FROM users) <> e.operators
     OR (SELECT count(*) FROM users WHERE role <> 'OPERATOR') <> 0 THEN
    RAISE EXCEPTION '회원 확인 실패: 운영자 %명만 남아야 하는데 %명', e.operators, (SELECT count(*) FROM users);
  END IF;
  IF (SELECT count(*) FROM operator_profiles) <> e.operator_profiles THEN RAISE EXCEPTION '운영자 프로필 수가 바뀌었습니다'; END IF;
  IF (SELECT count(*) FROM user_consents) <> e.operator_consents THEN RAISE EXCEPTION '운영자 동의 기록 수가 바뀌었습니다'; END IF;
  IF (SELECT count(*) FROM platform_settings) <> e.platform_settings THEN RAISE EXCEPTION 'platform_settings가 바뀌었습니다'; END IF;
  IF (SELECT count(*) FROM tags) <> e.tags THEN RAISE EXCEPTION 'tags가 바뀌었습니다'; END IF;
  IF (SELECT count(*) FROM _prisma_migrations) <> e.prisma_migrations THEN RAISE EXCEPTION '_prisma_migrations가 바뀌었습니다'; END IF;
  IF current_setting('reset.audit') = 'keep_operator' THEN
    IF (SELECT count(*) FROM audit_logs) <> e.operator_audit_logs THEN RAISE EXCEPTION '운영자 감사 기록 수가 바뀌었습니다'; END IF;
  ELSIF (SELECT count(*) FROM audit_logs) <> 0 THEN
    RAISE EXCEPTION 'audit_logs가 비지 않았습니다';
  END IF;

  -- 비어야 하는 것
  SELECT string_agg(tbl || '=' || after, ', ') INTO bad FROM reset_counts
  WHERE after <> 0 AND tbl NOT IN ('users', 'operator_profiles', 'user_consents', 'audit_logs',
                                   'platform_settings', 'tags', '_prisma_migrations');
  IF bad IS NOT NULL THEN RAISE EXCEPTION '비어야 하는 표가 남았습니다: %', bad; END IF;

  IF current_setting('reset.simulate_failure') = 'true' THEN
    RAISE EXCEPTION '리허설: 일부러 실패시킵니다 (simulate_failure=true) — 아무것도 지워지지 않아야 합니다';
  END IF;

  RAISE NOTICE '확인 통과: 운영자 %명, platform_settings %, tags %, 마이그레이션 기록 % 그대로',
    e.operators, e.platform_settings, e.tags, e.prisma_migrations;
END $$;

\if :apply
  COMMIT;
  \echo '=== 적용했습니다 (COMMIT). 이어서 문서의 5단계(저장소 파일 삭제)와 6단계(확인)를 진행합니다. ==='
\else
  ROLLBACK;
  \echo '=== 미리 보기였습니다 (ROLLBACK). 아무것도 지우지 않았습니다. 실제로 지우려면 -v apply=true ==='
\endif
