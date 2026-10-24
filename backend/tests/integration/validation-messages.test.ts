import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, nextPhone } from '../helpers/factory';

/**
 * 검증 오류가 사용자에게 어떻게 보이는지 고정한다.
 * zod 4로 올리면서 기본 문구가 전부 바뀌었기 때문에, 화면에 나가는 문장을 여기서 지킨다.
 * 영어 기본 문구나 'string'·'number' 같은 타입 이름이 섞이면 실패한다.
 */
describeDb('검증 오류 문구', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const agreements = { age14: true, terms: true, privacy: true };

  const signup = (over: Record<string, unknown> = {}) =>
    request(app).post('/api/v1/auth/register').send({
      email: `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`,
      password: 'pass1234', name: '맘', role: 'PARTICIPANT', phone: nextPhone(), agreements, ...over,
    });

  async function message(res: request.Response): Promise<string> {
    expect(res.status).toBe(400);
    return res.body.error.message as string;
  }

  const MISSION = {
    title: '미션', description: '설명', category: 'SNS',
    regionSi: '서울특별시', regionGu: '마포구', maxParticipants: 5, rewardAmount: 30000,
    startDate: '2026-11-01', endDate: '2026-11-10', submissionDeadline: '2026-11-20',
  };

  describe('가입', () => {
    it('zod가 만드는 문구는 칸 이름을 붙인 한국어로 나온다', async () => {
      expect(await message(await signup({ email: 'nope' }))).toBe('이메일: 형식을 확인해 주세요');
      expect(await message(await signup({ email: undefined }))).toBe('이메일: 필수 항목이에요');
      expect(await message(await signup({ email: `${'a'.repeat(330)}@b.com` }))).toBe('이메일: 320자 이하로 입력해 주세요');
    });

    it('스키마에 적어 둔 문구는 그대로 나온다', async () => {
      expect(await message(await signup({ password: '123' }))).toBe('비밀번호는 8자 이상이어야 합니다');
      expect(await message(await signup({ password: '12345678' }))).toBe('비밀번호에 영문을 넣어 주세요');
      expect(await message(await signup({ password: 'abcdefgh' }))).toBe('비밀번호에 숫자를 넣어 주세요');
      expect(await message(await signup({ name: '' }))).toBe('이름을 입력해주세요');
      expect(await message(await signup({ phone: '0212345678' }))).toBe('010으로 시작하는 휴대폰 번호를 입력해주세요');
      expect(await message(await signup({ role: 'OPERATOR' }))).toBe('참여자 또는 고객사로만 가입할 수 있습니다');
    });
  });

  describe('동의', () => {
    it('항목별 문구가 그대로 나온다', async () => {
      expect(await message(await signup({ agreements: { ...agreements, age14: false } })))
        .toBe('만 14세 이상만 가입할 수 있습니다');
      expect(await message(await signup({ agreements: { ...agreements, terms: false } })))
        .toBe('이용약관에 동의해 주세요');
      expect(await message(await signup({ agreements: { ...agreements, privacy: false } })))
        .toBe('개인정보 수집·이용에 동의해 주세요');
    });

    it('동의 항목을 아예 안 보내면', async () => {
      expect(await message(await signup({ agreements: undefined }))).toBe('약관 동의가 필요합니다');
    });
  });

  describe('비밀번호 재설정', () => {
    it('이메일 형식', async () => {
      const res = await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'nope' });
      expect(await message(res)).toBe('이메일: 형식을 확인해 주세요');
    });

    it('재설정 링크가 짧으면', async () => {
      const res = await request(app).post('/api/v1/auth/password-reset/confirm')
        .send({ token: 'short', newPassword: 'pass1234' });
      expect(await message(res)).toBe('인증 링크: 20자 이상으로 입력해 주세요');
    });
  });

  describe('미션 등록 (운영자 대행)', () => {
    let token: string;
    beforeEach(async () => { token = (await createOperator()).token; });

    const create = (over: Record<string, unknown> = {}) =>
      request(app).post('/api/v1/missions').set('Authorization', `Bearer ${token}`).send({ ...MISSION, ...over });

    it('빠진 칸과 길이·범위', async () => {
      expect(await message(await create({ title: undefined }))).toBe('미션 제목: 필수 항목이에요');
      expect(await message(await create({ title: 'a'.repeat(201) }))).toBe('미션 제목: 200자 이하로 입력해 주세요');
      expect(await message(await create({ maxParticipants: 0 }))).toBe('모집 인원: 1 이상으로 입력해 주세요');
      expect(await message(await create({ maxParticipants: 5000 }))).toBe('모집 인원: 1000 이하로 입력해 주세요');
      expect(await message(await create({ category: 'NOPE' }))).toBe('미션 유형: 고를 수 있는 값이 아니에요');
      expect(await message(await create({ momTags: ['WEEKDAY_DAY', 'WEEKEND_OK', 'KID_FRIENDLY', 'AT_HOME', 'WEEKDAY_DAY'] })))
        .toBe('엄마 시간 태그: 4개까지 고를 수 있어요');
    });

    it('우리가 적어 둔 문구는 그대로', async () => {
      expect(await message(await create({ regionSi: '청주시' }))).toBe('시·도를 선택해 주세요 (예: 충청북도)');
      expect(await message(await create({ endDate: '2026-10-01' }))).toBe('신청 마감일은 신청 시작일 이후여야 합니다');
      expect(await message(await create({ announceDate: '2026-11-05' }))).toBe('선정 발표일은 신청 마감일 이후여야 합니다');
    });
  });

  describe('미션 지원', () => {
    it('미션 id 형식', async () => {
      const p = await createParticipant();
      const res = await request(app).post('/api/v1/submissions/apply')
        .set('Authorization', `Bearer ${p.token}`).send({ missionId: 'nope' });
      expect(await message(res)).toBe('미션: 형식을 확인해 주세요');
    });

    it('지원 동기 길이', async () => {
      const p = await createParticipant();
      const client = await createClient();
      const mission = await createMission(client.profile.id);
      const res = await request(app).post('/api/v1/submissions/apply')
        .set('Authorization', `Bearer ${p.token}`)
        .send({ missionId: mission.id, message: 'a'.repeat(2001) });
      expect(await message(res)).toBe('지원 동기: 2000자 이하로 입력해 주세요');
    });
  });

  it('응답 어디에도 영어 기본 문구나 타입 이름이 남지 않는다', async () => {
    const operator = await createOperator();
    const mission = (over: Record<string, unknown>) =>
      request(app).post('/api/v1/missions').set('Authorization', `Bearer ${operator.token}`)
        .send({ ...MISSION, ...over });

    const responses = [
      await signup({ email: 'nope' }),
      await signup({ email: undefined }),
      await signup({ name: undefined }),
      await signup({ role: 'OPERATOR' }),
      await signup({ agreements: undefined }),
      await signup({ agreements: 'yes' }),
      await signup({ password: 123 }),
      await mission({ title: undefined }),
      await mission({ rewardAmount: 'many' }),
      await mission({ startDate: 'nope' }),
      await mission({ momTags: ['NOPE'] }),
      await mission({ destinationUrl: 'nope' }),
    ];

    // zod 3·4의 영어 기본 문구와, zod 4 한국어 로케일이 쓰는 타입 이름까지 모두 막는다
    const banned = [
      'Invalid', 'Expected', 'Required', 'Too big', 'Too small', 'must contain', 'received',
      'string', 'number', 'boolean', 'array', 'undefined', 'NaN',
      '잘못된', '너무 큽니다', '너무 작습니다', '문자 이하', '문자 이상', '예상 타입',
    ];
    for (const res of responses) {
      expect(res.status).toBe(400);
      const msg = res.body.error.message as string;
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
      for (const word of banned) {
        expect(msg).not.toContain(word);
      }
    }
  });
});
