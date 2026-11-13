-- 새 미션 알림 (app-feel PR 7). 칸을 더하기만 한다 — 기존 행·기존 칸은 바뀌지 않는다.
-- 참여자: 알림 받기 여부. 기존 참여자는 모두 false(꺼짐)로 시작한다
ALTER TABLE "participant_profiles" ADD COLUMN "newMissionAlerts" BOOLEAN NOT NULL DEFAULT false;
-- 미션: 새 미션 알림을 보낸 시각. 기존 미션은 모두 NULL (이미 열린 미션에 알림이 한꺼번에 나가지 않는다 — 알림은 '열리는 순간'에만 보낸다)
ALTER TABLE "missions" ADD COLUMN "openAlertedAt" TIMESTAMP(3);
