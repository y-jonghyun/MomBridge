import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { randomBase62, TRACKING_CODE_LENGTH } from '../../lib/random';
import { trackingUrlFor } from './destination';

/** 체험단원 × 캠페인(Application)의 추적 링크를 돌려준다. 없으면 새로 발급 (멱등) */
export async function ensureTrackingLink(applicationId: string) {
  const existing = await prisma.trackingLink.findUnique({ where: { applicationId } });
  if (existing) return existing;

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error('application not found');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.trackingLink.create({
        data: {
          code: randomBase62(TRACKING_CODE_LENGTH),
          applicationId,
          missionId: application.missionId,
          participantId: application.participantId,
        },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      // 같은 지원서에 동시에 발급된 경우 → 이미 있는 링크 사용, 코드 충돌이면 재시도
      const raced = await prisma.trackingLink.findUnique({ where: { applicationId } });
      if (raced) return raced;
    }
  }
  throw new Error('could not allocate a unique tracking code');
}

/** TRACKING_BASE_URL이 설정되지 않았으면 null (링크를 잘못된 도메인으로 내보내지 않는다) */
export function publicTrackingUrl(code: string): string | null {
  return env.TRACKING_BASE_URL ? trackingUrlFor(env.TRACKING_BASE_URL, code) : null;
}
