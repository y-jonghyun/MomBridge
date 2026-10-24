import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';
import { netReward, platformFee } from '../../src/config/fees';

/**
 * 콘텐츠를 승인하면 만들어지는 정산 금액.
 * 원 단위 아래는 버린다 — 화면(frontend/src/lib/fees.ts)이 보여 준 실수령액과 같아야 한다.
 */
describeDb('정산 금액 계산', () => {
  let operator: Awaited<ReturnType<typeof createOperator>>;

  beforeEach(async () => {
    await resetDb();
    operator = await createOperator();
  });
  afterAll(() => prisma.$disconnect());

  /** 보상이 rewardAmount인 미션을 승인까지 끌고 가서 만들어진 정산 행을 돌려준다 */
  async function approve(rewardAmount: number) {
    const client = await createClient();
    const participant = await createParticipant();
    const mission = await createMission(client.profile.id, { rewardAmount });
    const application = await prisma.application.create({
      data: { missionId: mission.id, participantId: participant.profile.id, status: 'APPROVED' },
    });
    const submission = await prisma.submission.create({
      data: {
        missionId: mission.id, applicationId: application.id, participantId: participant.profile.id,
        status: 'SUBMITTED', contentUrl: 'https://blog.naver.com/a/1',
        snsPostUrl: 'https://blog.naver.com/a/1',
      } as never,
    });

    const res = await request(app)
      .patch(`/api/v1/submissions/${submission.id}/review`)
      .set({ Authorization: `Bearer ${operator.token}` })
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(200);

    const payout = await prisma.payout.findFirstOrThrow({ where: { submissionId: submission.id } });
    return {
      fee: Number(payout.platformFee),
      net: Number(payout.netAmount),
      amount: Number(payout.amount),
    };
  }

  it('20,000원이면 수수료 2,000원 · 실지급 18,000원', async () => {
    expect(await approve(20000)).toEqual({ amount: 20000, fee: 2000, net: 18000 });
  });

  it('15,005원이면 원 아래를 버려 수수료 1,500원 · 실지급 13,505원', async () => {
    expect(await approve(15005)).toEqual({ amount: 15005, fee: 1500, net: 13505 });
  });

  it('수수료와 실지급을 더하면 보상이 된다', async () => {
    const { amount, fee, net } = await approve(15005);
    expect(fee + net).toBe(amount);
  });

  it('계산식은 config/fees.ts 한 곳에서 온다', () => {
    // 화면(frontend/src/lib/fees.ts)에도 같은 식이 있다 — 둘이 어긋나면 입금액이 달라진다
    expect(platformFee(20000)).toBe(2000);
    expect(netReward(20000)).toBe(18000);
    expect(platformFee(15005)).toBe(1500);
    expect(netReward(15005)).toBe(13505);
    // 소수점이 붙은 Decimal 값이 와도 원 단위로 떨어진다
    expect(Number.isInteger(platformFee(9999))).toBe(true);
    expect(Number.isInteger(netReward(9999))).toBe(true);
  });
});
