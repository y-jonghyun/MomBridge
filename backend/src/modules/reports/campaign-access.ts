import { Request } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

/**
 * 광고주는 자기 미션만, 운영자는 모든 미션에 접근한다.
 * 남의 미션이면 존재 여부도 알리지 않도록 404를 돌려준다.
 */
export async function requireCampaignAccess(req: Request, missionId: string) {
  const user = req.user!;
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, clientProfileId: true, createdAt: true, clientProfile: { select: { userId: true } } },
  });
  // 경로가 가게 계정만 받는다(campaign.routes). 그래도 여기서 다시 본인 미션인지 확인한다
  const allowed = mission && user.role === 'CLIENT' && mission.clientProfile.userId === user.sub;
  if (!mission || !allowed) throw new AppError('NOT_FOUND', 404, '미션을 찾을 수 없습니다');
  return mission;
}
