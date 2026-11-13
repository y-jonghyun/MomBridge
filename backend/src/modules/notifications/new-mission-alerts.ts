import { prisma } from '../../config/database';
import { clock } from '../../lib/clock';
import { reportIssue } from '../../lib/monitoring';
import { normalizeProvince, provinceVariants } from '../../lib/regions';
import { recruitingCutoff } from '../missions/mission-lifecycle';

/**
 * 새 미션 알림 — 미션이 열리면(OPEN) 같은 시·구를 활동 지역으로 둔 참여자 중
 * '새 미션 알림 받기'를 켠 사람에게 앱 안 알림(알림함)을 보낸다. 휴대폰 푸시·문자·메일은 보내지 않는다.
 *
 * - 미션마다 한 번만 보낸다: openAlertedAt을 먼저 '차지'한 요청만 보낸다 (동시에 두 번 열어도, 닫았다 다시 열어도 한 번).
 * - 목록에 보이는 미션만 (isVisible, 모집 마감 전) — 참여자가 눌러서 볼 수 없는 미션은 알리지 않는다.
 * - 이 일이 실패해도 상태 변경 자체는 막지 않는다 (호출하는 쪽이 기다리지만 오류는 삼킨다).
 */
export async function sendNewMissionAlerts(missionId: string): Promise<number> {
  try {
    const now = clock.now();
    const claimed = await prisma.mission.updateMany({
      where: {
        id: missionId, status: 'OPEN', isVisible: true, openAlertedAt: null,
        endDate: { gte: recruitingCutoff(now) },
      },
      data: { openAlertedAt: now },
    });
    if (claimed.count === 0) return 0;

    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: {
        id: true, title: true, regionSi: true, regionGu: true, regionDong: true,
        clientProfile: { select: { businessName: true, userId: true } },
      },
    });
    if (!mission || !mission.regionGu.trim()) return 0;

    // 시·도는 예전 표기('서울', '서울시')로 저장된 프로필도 찾는다. 구는 그대로 같아야 한다
    const si = normalizeProvince(mission.regionSi) ?? mission.regionSi;
    const subscribers = await prisma.participantProfile.findMany({
      where: {
        newMissionAlerts: true,
        regionSi: { in: provinceVariants(si) },
        regionGu: mission.regionGu,
        // 참여자 계정만 (예전에 운영자 계정에 생긴 참여자 프로필은 알리지 않는다)
        user: { role: 'PARTICIPANT', isActive: true, deletedAt: null },
      },
      select: { userId: true },
    });
    if (subscribers.length === 0) return 0;

    const place = [mission.regionGu.split(/\s+/).pop(), mission.regionDong].filter(Boolean).join(' ');
    const shop = mission.clientProfile?.businessName;
    const { count } = await prisma.notification.createMany({
      data: subscribers.map(s => ({
        userId: s.userId,
        type: 'MISSION_OPEN' as const,
        title: `${place}에 새 미션이 열렸어요`,
        body: shop ? `[${shop}] ${mission.title}` : mission.title,
        resourceId: mission.id,
        resourceType: 'mission',
      })),
    });
    return count;
  } catch (err) {
    reportIssue('new mission alerts failed', { area: 'api', extra: { missionId, message: (err as Error).message } });
    return 0;
  }
}
