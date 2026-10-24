import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, createTrackingLink } from '../helpers/factory';

/**
 * 관리자 업무 화면이 기대는 서버 동작.
 * - 정산: 계좌번호는 가려서 내보내고, 전체 보기는 기록이 남고, 계좌가 없으면 지급 완료를 막는다
 * - 검수: 반려·수정 요청에는 사유가 있어야 한다
 */
describeDb('관리자 업무', () => {
  let operator: Awaited<ReturnType<typeof createOperator>>;

  beforeEach(async () => {
    await resetDb();
    operator = await createOperator();
  });
  afterAll(() => prisma.$disconnect());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function makePayout(account: { bankName?: string; bankAccount?: string; accountHolder?: string } = {}) {
    const client = await createClient();
    const participant = await createParticipant();
    const mission = await createMission(client.profile.id);
    const application = await prisma.application.create({
      data: { missionId: mission.id, participantId: participant.profile.id, status: 'APPROVED' },
    });
    const submission = await prisma.submission.create({
      data: {
        missionId: mission.id, applicationId: application.id, participantId: participant.profile.id,
        status: 'APPROVED', contentUrl: 'https://blog.naver.com/a/1',
      } as never,
    });
    return prisma.payout.create({
      data: {
        submissionId: submission.id, participantId: participant.profile.id,
        amount: 30000, platformFee: 3000, netAmount: 27000, status: 'PENDING', ...account,
      },
    });
  }

  describe('정산 계좌', () => {
    const FULL = { bankName: '국민은행', bankAccount: '123456-78-901234', accountHolder: '김맘' };

    it('목록에는 끝 네 자리만 내려간다', async () => {
      await makePayout(FULL);
      const res = await request(app).get('/api/v1/operator/payouts?status=PENDING').set(auth(operator.token));

      expect(res.status).toBe(200);
      const [row] = res.body.data;
      expect(row.bankName).toBe('국민은행');
      expect(row.accountHolder).toBe('김맘');
      expect(row.bankAccount).toBe('****1234');
      expect(row.hasAccount).toBe(true);
      // 전체 번호는 목록 어디에도 없다
      expect(JSON.stringify(res.body)).not.toContain('123456');
    });

    it('전체 보기는 기록을 남긴다', async () => {
      const payout = await makePayout(FULL);

      const res = await request(app).get(`/api/v1/operator/payouts/${payout.id}/account`).set(auth(operator.token));
      expect(res.status).toBe(200);
      expect(res.body.data.bankAccount).toBe('123456-78-901234');

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'PAYOUT_ACCOUNT_VIEW' } });
      expect(log.actorId).toBe(operator.user.id);
      expect(log.targetId).toBe(payout.id);
      // 기록만 봐서는 계좌번호를 알 수 없어야 한다
      expect(JSON.stringify(log.after)).not.toContain('123456');
    });

    it('계좌가 없으면 미등록으로 보이고 지급 완료로 바꿀 수 없다', async () => {
      const payout = await makePayout();

      const list = await request(app).get('/api/v1/operator/payouts?status=PENDING').set(auth(operator.token));
      expect(list.body.data[0].hasAccount).toBe(false);
      expect(list.body.data[0].bankAccount).toBeNull();

      const done = await request(app).patch(`/api/v1/operator/payouts/${payout.id}`)
        .set(auth(operator.token)).send({ status: 'COMPLETED' });
      expect(done.status).toBe(400);
      expect(done.body.error.code).toBe('NO_ACCOUNT');

      const after = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
      expect(after.status).toBe('PENDING');

      // 계좌 전체 보기도 막힌다
      const view = await request(app).get(`/api/v1/operator/payouts/${payout.id}/account`).set(auth(operator.token));
      expect(view.status).toBe(400);
    });

    it('계좌가 있으면 지급 완료로 바뀐다', async () => {
      const payout = await makePayout(FULL);
      const done = await request(app).patch(`/api/v1/operator/payouts/${payout.id}`)
        .set(auth(operator.token)).send({ status: 'COMPLETED' });

      expect(done.status).toBe(200);
      const after = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
      expect(after.status).toBe('COMPLETED');
      expect(after.completedAt).not.toBeNull();
    });

    it('운영자가 아니면 계좌를 볼 수 없다', async () => {
      const payout = await makePayout(FULL);
      const participant = await createParticipant();
      const res = await request(app).get(`/api/v1/operator/payouts/${payout.id}/account`).set(auth(participant.token));
      expect(res.status).toBe(403);
      expect(await prisma.auditLog.count({ where: { action: 'PAYOUT_ACCOUNT_VIEW' } })).toBe(0);
    });
  });

  describe('검수', () => {
    async function pendingSubmission() {
      const client = await createClient();
      const participant = await createParticipant();
      const mission = await createMission(client.profile.id, { category: 'SNS' });
      // 추적 링크까지 만들어 둔다 (검수 화면이 방문 수를 함께 보여 준다)
      const { application, link } = await createTrackingLink(mission.id, participant.profile.id);
      const submission = await prisma.submission.create({
        data: {
          missionId: mission.id, applicationId: application.id, participantId: participant.profile.id,
          status: 'SUBMITTED', contentUrl: 'https://blog.naver.com/a/1',
          snsPostUrl: 'https://blog.naver.com/a/1', mediaUrls: ['https://files.example/a.jpg'],
        } as never,
      });
      return { submission, application, link };
    }

    const review = (id: string, body: Record<string, unknown>) =>
      request(app).patch(`/api/v1/submissions/${id}/review`).set(auth(operator.token)).send(body);

    it('반려에는 사유가 있어야 한다', async () => {
      const { submission } = await pendingSubmission();

      const without = await review(submission.id, { status: 'REJECTED' });
      expect(without.status).toBe(400);
      expect(without.body.error.message).toBe('반려 사유를 적어 주세요');

      const blank = await review(submission.id, { status: 'REJECTED', rejectionReason: '   ' });
      expect(blank.status).toBe(400);

      // 사유가 있으면 통과하고 그대로 저장된다
      const ok = await review(submission.id, { status: 'REJECTED', rejectionReason: '대가 표시 문구가 없습니다' });
      expect(ok.status).toBe(200);
      const after = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
      expect(after.status).toBe('REJECTED');
      expect(after.rejectionReason).toBe('대가 표시 문구가 없습니다');
    });

    it('수정 요청에도 사유가 있어야 한다', async () => {
      const { submission } = await pendingSubmission();

      const without = await review(submission.id, { status: 'REVISION' });
      expect(without.status).toBe(400);
      expect(without.body.error.message).toBe('무엇을 고쳐야 하는지 적어 주세요');

      const ok = await review(submission.id, { status: 'REVISION', rejectionReason: '글 맨 위에 문구를 넣어 주세요' });
      expect(ok.status).toBe(200);
    });

    it('승인에는 사유가 필요 없다', async () => {
      const { submission } = await pendingSubmission();
      expect((await review(submission.id, { status: 'APPROVED' })).status).toBe(200);
    });

    it('검수 목록은 추적 링크 방문 수를 함께 준다', async () => {
      const { submission, link } = await pendingSubmission();
      await prisma.clickDaily.create({
        data: { linkId: link.id, dayKey: new Date('2026-10-20'), totalClicks: 7, uniqueVisitors: 4 },
      });
      await prisma.clickDaily.create({
        data: { linkId: link.id, dayKey: new Date('2026-10-21'), totalClicks: 3, uniqueVisitors: 2 },
      });

      const res = await request(app).get('/api/v1/submissions/pending').set(auth(operator.token));
      expect(res.status).toBe(200);
      const row = res.body.data.find((x: { id: string }) => x.id === submission.id);
      expect(row.traffic).toEqual({ clicks: 10, uniqueVisitors: 6 });
      expect(row.mediaUrls).toEqual(['https://files.example/a.jpg']);
    });
  });
});
