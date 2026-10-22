import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getMissionKeywords } from '../missions/mission-extras';
import { ensureTrackingLink, publicTrackingUrl } from '../tracking/links';
import { buildParticipantStats } from '../reports/report.service';
import { SELF_CLICK_MAX_AGE_SEC, selfClickToken } from '../tracking/self-click';

const router = Router();
router.use(authenticate, requireRole('PARTICIPANT', 'OPERATOR'));

/** 체험단원 가이드에 보여줄 대가 표시 예시 (공정위 심사지침: 제목 또는 본문 첫 부분, 본문과 구분되게) */
const DISCLOSURE_EXAMPLES = [
  '[광고] 이 글은 ○○(업체명)으로부터 제품을 무상으로 제공받아 작성했습니다.',
  '이 글은 ○○(업체명)으로부터 소정의 원고료를 지원받아 작성했습니다.',
];

async function getOrCreateParticipantProfile(userId: string) {
  return prisma.participantProfile.upsert({
    where: { userId },
    create: { userId, regionSi: '', regionGu: '' },
    update: {},
  });
}

// 본인 클릭 제외용 서명 값 — 프론트가 /r 경로 쿠키로 저장한다
router.get('/self-click-token', requireRole('PARTICIPANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);
    res.json({ success: true, data: { token: selfClickToken(profile.id), maxAgeSec: SELF_CLICK_MAX_AGE_SEC } });
  } catch (e) { next(e); }
});

// 내 지원 목록
router.get('/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);

    const applications = await prisma.application.findMany({
      where: { participantId: profile.id },
      include: { mission: { select: { title: true, rewardAmount: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: applications });
  } catch (e) { next(e); }
});

// 승인된 미션의 작성 가이드: 키워드 + 추적 링크 + 대가 표시 안내
router.get('/missions/:missionId/guide', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);
    const application = await prisma.application.findFirst({
      where: { missionId: req.params.missionId, participantId: profile.id, status: 'APPROVED' },
      include: { mission: { select: { title: true, category: true, requirements: true, destinationUrl: true } } },
    });
    if (!application) throw new AppError('NOT_FOUND', 404, '승인된 미션을 찾을 수 없습니다');

    const [keywords, link] = await Promise.all([getMissionKeywords(req.params.missionId), ensureTrackingLink(application.id)]);
    res.json({
      success: true,
      data: {
        missionTitle: application.mission.title,
        requirements: application.mission.requirements,
        requiresBlogReview: application.mission.category === 'REVIEW',
        mainKeyword: keywords.main?.keyword ?? null,
        subKeywords: keywords.subs.map(k => k.keyword),
        // 광고주가 도착 URL을 등록하기 전에는 링크를 보여주지 않는다 (눌러도 이동할 곳이 없음)
        trackingUrl: application.mission.destinationUrl ? publicTrackingUrl(link.code) : null,
        trackingUnavailableReason: !application.mission.destinationUrl ? 'NO_DESTINATION' : !publicTrackingUrl(link.code) ? 'NOT_CONFIGURED' : null,
        trackingInstruction: '글에 추적 링크 1개를 넣으세요',
        disclosureInstruction:
          '대가를 받았다는 사실을 글 제목 또는 본문 첫 부분에, 본문보다 크거나 다른 색 글자로 적어 주세요. ' +
          '이미지로만 표시하면 자동 확인이 안 되어 검수가 늦어질 수 있습니다.',
        disclosureExamples: DISCLOSURE_EXAMPLES,
      },
    });
  } catch (e) { next(e); }
});

// 내 리뷰별 유입 수
router.get('/reviews/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);
    res.json({ success: true, data: await buildParticipantStats(profile.id) });
  } catch (e) { next(e); }
});

// 내 정산 내역
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getOrCreateParticipantProfile(req.user!.sub);

    const payouts = await prisma.payout.findMany({
      where: { participantId: profile.id },
      include: { submission: { include: { mission: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  } catch (e) { next(e); }
});

export default router;
