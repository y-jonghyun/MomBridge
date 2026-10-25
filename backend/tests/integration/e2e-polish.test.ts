import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';

/**
 * 내부 시험에서 나온 두 가지.
 * - 종료(CLOSED)된 미션에는 후기를 받지 않는다 (화면에서도 '진행 중'에서 빠진다)
 * - 지원서 승인 화면이 판단할 자료(활동 지역·SNS 채널·지난 참여)를 함께 내려준다
 */
describeDb('화면 개선에 필요한 서버 동작', () => {
  let operator: Awaited<ReturnType<typeof createOperator>>;

  beforeEach(async () => {
    await resetDb();
    operator = await createOperator();
  });
  afterAll(() => prisma.$disconnect());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('종료된 미션', () => {
    async function approvedOn(status: 'OPEN' | 'CLOSED') {
      const client = await createClient();
      const participant = await createParticipant();
      const mission = await createMission(client.profile.id, { status });
      await prisma.application.create({
        data: { missionId: mission.id, participantId: participant.profile.id, status: 'APPROVED' },
      });
      return { mission, participant };
    }

    it('후기를 제출할 수 없다', async () => {
      const { mission, participant } = await approvedOn('CLOSED');

      const res = await request(app).post('/api/v1/submissions').set(auth(participant.token))
        .send({ missionId: mission.id, description: '다녀왔어요', snsPostUrl: 'https://instagram.com/p/1' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MISSION_CLOSED');
      expect(res.body.error.message).toContain('종료된 미션');
      expect(await prisma.submission.count()).toBe(0);
    });

    it('모집 중인 미션은 그대로 제출된다', async () => {
      const { mission, participant } = await approvedOn('OPEN');

      const res = await request(app).post('/api/v1/submissions').set(auth(participant.token))
        .send({ missionId: mission.id, description: '다녀왔어요', snsPostUrl: 'https://instagram.com/p/1' });

      expect(res.status).toBe(201);
    });
  });

  describe('대가 표시 확인 없이는 승인하지 않는다', () => {
    /** 자동 확인 대상이 아닌 유형(SNS)의 검수 대기 제출물 */
    async function submitted(category = 'SNS') {
      const client = await createClient();
      const participant = await createParticipant();
      const mission = await createMission(client.profile.id, { category });
      const application = await prisma.application.create({
        data: { missionId: mission.id, participantId: participant.profile.id, status: 'APPROVED' },
      });
      const submission = await prisma.submission.create({
        data: {
          missionId: mission.id, applicationId: application.id, participantId: participant.profile.id,
          status: 'SUBMITTED', contentUrl: 'https://instagram.com/p/1', snsPostUrl: 'https://instagram.com/p/1',
        } as never,
      });
      return { submission, participant };
    }

    const review = (id: string, body: Record<string, unknown>) =>
      request(app).patch(`/api/v1/submissions/${id}/review`).set(auth(operator.token)).send(body);
    const confirm = (id: string, body: Record<string, unknown> = {}) =>
      request(app).post(`/api/v1/submissions/${id}/disclosure-confirm`).set(auth(operator.token)).send(body);

    it('체크 전에는 승인할 수 없다', async () => {
      const { submission } = await submitted();

      const res = await review(submission.id, { status: 'APPROVED' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('DISCLOSURE_REQUIRED');
      expect(res.body.error.message).toContain('체크한 뒤 승인');
      // 정산도 만들어지지 않는다
      expect(await prisma.payout.count()).toBe(0);
    });

    it('체크하면 누가 언제 확인했는지 남고, 그 뒤에 승인된다', async () => {
      const { submission } = await submitted();

      const checked = await confirm(submission.id);
      expect(checked.status).toBe(200);
      expect(checked.body.data.disclosureConfirmedBy.user.name).toBeTruthy();

      const stored = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
      expect(stored.disclosureCheck).toBe('MANUAL_CONFIRMED');
      expect(stored.disclosureConfirmedById).toBe(operator.profile.id);
      expect(stored.disclosureConfirmedAt).toBeInstanceOf(Date);
      expect(stored.disclosureConfirmNote).toContain('직접 확인');

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { targetId: submission.id } });
      expect(audit.action).toBe('SUBMISSION_DISCLOSURE_MANUAL_CONFIRM');

      expect((await review(submission.id, { status: 'APPROVED' })).status).toBe(200);
      expect(await prisma.payout.count()).toBe(1);
    });

    it('반려·수정 요청은 체크하지 않아도 할 수 있다', async () => {
      const { submission } = await submitted();

      const res = await review(submission.id, { status: 'REVISION', rejectionReason: '대가 표시를 넣어 주세요' });

      expect(res.status).toBe(200);
    });

    it('이미 검수가 끝난 제출물은 확인 처리하지 않는다', async () => {
      const { submission } = await submitted();
      await confirm(submission.id);
      await review(submission.id, { status: 'APPROVED' });
      const approved = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });

      const again = await confirm(submission.id, { reason: '다시 확인' });

      expect(again.status).toBe(409);
      const after = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
      expect(after.disclosureConfirmedAt).toEqual(approved.disclosureConfirmedAt);
      expect(after.disclosureConfirmNote).toBe(approved.disclosureConfirmNote);
    });

    it('리뷰(블로그) 캠페인은 전처럼 사유를 받는다', async () => {
      const { submission } = await submitted('REVIEW');
      await prisma.submission.update({
        where: { id: submission.id }, data: { disclosureCheck: 'NEEDS_MANUAL_REVIEW' },
      });

      expect((await confirm(submission.id)).status).toBe(400);
      expect((await confirm(submission.id, { reason: '본문 첫 이미지에서 확인' })).status).toBe(200);
    });
  });

  describe('지원서 승인 화면이 쓸 자료', () => {
    it('활동 지역·SNS 채널·지난 참여를 함께 내려준다', async () => {
      const client = await createClient();
      const participant = await createParticipant();
      const mission = await createMission(client.profile.id, { regionGu: '마포구' });
      await prisma.application.create({
        data: { missionId: mission.id, participantId: participant.profile.id, status: 'PENDING' },
      });

      // 지난 참여 이력 — 승인 2건, 반려 1건 (한 미션에 한 번만 지원할 수 있어 미션을 따로 만든다)
      for (const [i, status] of (['APPROVED', 'APPROVED', 'REJECTED'] as const).entries()) {
        const past = await createMission(client.profile.id, { title: `지난 미션 ${i + 1}` });
        const application = await prisma.application.create({
          data: { missionId: past.id, participantId: participant.profile.id, status: 'APPROVED' },
        });
        await prisma.submission.create({
          data: {
            missionId: past.id, applicationId: application.id, participantId: participant.profile.id,
            status, contentUrl: 'https://blog.naver.com/a/1',
          } as never,
        });
      }

      const res = await request(app).get('/api/v1/operator/applications?status=PENDING').set(auth(operator.token));
      expect(res.status).toBe(200);

      const row = res.body.data.find((a: { missionId: string }) => a.missionId === mission.id);
      expect(row.participant.regionSi).toBeTruthy();
      expect(row.participant.regionGu).toBeTruthy();
      expect(row.mission.regionGu).toBe('마포구');
      // 참여자가 등록해 둔 SNS 채널 (운영자 화면에서만 본다)
      expect(row.participant.snsAccounts.length).toBeGreaterThan(0);
      expect(row.participant.snsAccounts[0].url).toBeTruthy();
      expect(row.history).toEqual({ approved: 2, rejected: 1 });
    });

    it('참여 이력이 없으면 0으로 내려준다', async () => {
      const client = await createClient();
      const participant = await createParticipant();
      const mission = await createMission(client.profile.id);
      await prisma.application.create({
        data: { missionId: mission.id, participantId: participant.profile.id, status: 'PENDING' },
      });

      const res = await request(app).get('/api/v1/operator/applications').set(auth(operator.token));
      expect(res.body.data[0].history).toEqual({ approved: 0, rejected: 0 });
    });
  });
});
