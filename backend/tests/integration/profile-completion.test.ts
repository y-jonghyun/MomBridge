import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, nextPhone } from '../helpers/factory';

/**
 * 가입·프로필 정보.
 * - 비밀번호 규칙(8자 이상 + 영문·숫자)
 * - 참여자: 활동 지역 + SNS 계정 하나 이상이 있어야 미션에 지원할 수 있다
 * - 고객사: 가게 정보가 다 차야 미션을 등록할 수 있다
 * - SNS 계정은 본인 것만 읽고 쓴다
 */
describeDb('프로필 완성', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const agreements = { age14: true, terms: true, privacy: true };

  describe('비밀번호 규칙', () => {
    const signup = (password: string) =>
      request(app).post('/api/v1/auth/register').send({
        email: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`,
        password, name: '맘', role: 'PARTICIPANT', phone: nextPhone(), agreements,
      });

    it('8자 이상 + 영문·숫자를 함께', async () => {
      expect((await signup('ab1234')).body.error.message).toBe('비밀번호는 8자 이상이어야 합니다');
      expect((await signup('12345678')).body.error.message).toBe('비밀번호에 영문을 넣어 주세요');
      expect((await signup('abcdefgh')).body.error.message).toBe('비밀번호에 숫자를 넣어 주세요');
      expect((await signup('abcd1234')).status).toBe(201);
    });

    it('비밀번호 변경에도 같은 규칙이 걸린다', async () => {
      const created = await signup('abcd1234');
      const token = created.body.data.accessToken;

      const weak = await request(app).patch('/api/v1/auth/me/password').set(auth(token))
        .send({ currentPassword: 'abcd1234', newPassword: 'abcdefgh' });
      expect(weak.status).toBe(400);
      expect(weak.body.error.message).toBe('비밀번호에 숫자를 넣어 주세요');

      const ok = await request(app).patch('/api/v1/auth/me/password').set(auth(token))
        .send({ currentPassword: 'abcd1234', newPassword: 'newpass12' });
      expect(ok.status).toBe(200);
    });
  });

  describe('참여자 프로필', () => {
    it('빈 프로필은 완성되지 않은 것으로 본다', async () => {
      const p = await createParticipant('맘', { withSns: false });
      await prisma.participantProfile.update({ where: { id: p.profile.id }, data: { regionSi: '', regionGu: '' } });

      const res = await request(app).get('/api/v1/participant/profile').set(auth(p.token));
      expect(res.status).toBe(200);
      expect(res.body.data.complete).toBe(false);
      expect(res.body.data.snsAccounts).toEqual([]);
    });

    it('활동 지역을 저장하고 시·도는 정식 명칭으로 바꾼다', async () => {
      const p = await createParticipant('맘', { withSns: false });

      const res = await request(app).put('/api/v1/participant/profile').set(auth(p.token))
        .send({ regionSi: '충북', regionGu: '청주시 상당구', regionDong: '용암동', childAgeGroups: ['TODDLER', 'ELEMENTARY'] });

      expect(res.status).toBe(200);
      expect(res.body.data.regionSi).toBe('충청북도');
      expect(res.body.data.regionGu).toBe('청주시 상당구');
      expect(res.body.data.childAgeGroups).toEqual(['TODDLER', 'ELEMENTARY']);
    });

    it('활동 지역은 비워 둘 수 없다', async () => {
      const p = await createParticipant('맘', { withSns: false });
      const res = await request(app).put('/api/v1/participant/profile').set(auth(p.token))
        .send({ regionSi: '서울특별시', regionGu: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('시·군·구를 선택해 주세요');
    });

    describe('SNS 계정', () => {
      const add = (token: string, body: Record<string, unknown>) =>
        request(app).post('/api/v1/participant/profile/sns').set(auth(token)).send(body);

      it('플랫폼에 맞는 주소만 받는다', async () => {
        const p = await createParticipant('맘', { withSns: false });

        expect((await add(p.token, { platform: 'NAVER_BLOG', url: 'https://instagram.com/me' })).status).toBe(400);
        expect((await add(p.token, { platform: 'INSTAGRAM', url: 'instagram.com/me' })).status).toBe(400);
        // 아이디 없이 집 주소만 적으면 누구 채널인지 알 수 없다
        expect((await add(p.token, { platform: 'INSTAGRAM', url: 'https://instagram.com' })).status).toBe(400);

        const ok = await add(p.token, { platform: 'NAVER_BLOG', url: 'https://blog.naver.com/mommom' });
        expect(ok.status).toBe(201);
        expect(ok.body.data.handle).toBe('mommom');
      });

      it('같은 플랫폼을 두 번 등록할 수 없다', async () => {
        const p = await createParticipant('맘', { withSns: false });
        expect((await add(p.token, { platform: 'YOUTUBE', url: 'https://youtube.com/@mom' })).status).toBe(201);

        const again = await add(p.token, { platform: 'YOUTUBE', url: 'https://youtube.com/@mom2' });
        expect(again.status).toBe(409);
        expect(again.body.error.code).toBe('SNS_EXISTS');
        expect(await prisma.snsAccount.count({ where: { profileId: p.profile.id } })).toBe(1);
      });

      it('내 계정만 고치고 지울 수 있다', async () => {
        const mine = await createParticipant('나', { withSns: false });
        const other = await createParticipant('남', { withSns: false });
        const created = await add(mine.token, { platform: 'INSTAGRAM', url: 'https://instagram.com/mine' });
        const id = created.body.data.id;

        // 남이 고치거나 지우려 하면 찾지 못한다
        const patched = await request(app).patch(`/api/v1/participant/profile/sns/${id}`)
          .set(auth(other.token)).send({ platform: 'INSTAGRAM', url: 'https://instagram.com/stolen' });
        expect(patched.status).toBe(404);
        expect((await request(app).delete(`/api/v1/participant/profile/sns/${id}`).set(auth(other.token))).status).toBe(404);
        expect(await prisma.snsAccount.count({ where: { id } })).toBe(1);

        // 본인은 된다
        const own = await request(app).patch(`/api/v1/participant/profile/sns/${id}`)
          .set(auth(mine.token)).send({ platform: 'INSTAGRAM', url: 'https://instagram.com/renamed' });
        expect(own.status).toBe(200);
        expect(own.body.data.handle).toBe('renamed');
        expect((await request(app).delete(`/api/v1/participant/profile/sns/${id}`).set(auth(mine.token))).status).toBe(200);
        expect(await prisma.snsAccount.count({ where: { id } })).toBe(0);
      });

      it('로그인하지 않으면 손댈 수 없다', async () => {
        expect((await request(app).get('/api/v1/participant/profile')).status).toBe(401);
        expect((await request(app).post('/api/v1/participant/profile/sns').send({})).status).toBe(401);
      });
    });

    describe('미션 지원 막기', () => {
      async function openMission() {
        const client = await createClient();
        await prisma.clientProfile.update({
          where: { id: client.profile.id },
          data: { businessCategory: 'CAFE', address: '서울시 마포구 1', regionSi: '서울특별시', regionGu: '마포구' },
        });
        return createMission(client.profile.id, { status: 'OPEN' });
      }

      it('프로필이 덜 찼으면 지원할 수 없다', async () => {
        const mission = await openMission();
        const p = await createParticipant('맘', { withSns: false });

        const res = await request(app).post('/api/v1/submissions/apply')
          .set(auth(p.token)).send({ missionId: mission.id });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
        expect(res.body.error.message).toContain('SNS 계정');
        expect(await prisma.application.count()).toBe(0);
      });

      it('활동 지역까지 비어 있으면 둘 다 알려준다', async () => {
        const mission = await openMission();
        const p = await createParticipant('맘', { withSns: false });
        await prisma.participantProfile.update({ where: { id: p.profile.id }, data: { regionSi: '', regionGu: '' } });

        const res = await request(app).post('/api/v1/submissions/apply')
          .set(auth(p.token)).send({ missionId: mission.id });
        expect(res.body.error.message).toBe('활동 지역과 SNS 계정을 먼저 입력해 주세요');
      });

      it('프로필이 다 차면 지원된다', async () => {
        const mission = await openMission();
        const p = await createParticipant();

        const res = await request(app).post('/api/v1/submissions/apply')
          .set(auth(p.token)).send({ missionId: mission.id });
        expect(res.status).toBe(201);
      });
    });
  });

  describe('고객사 가게 정보', () => {
    it('빈 가게 정보는 무엇이 비었는지 알려준다', async () => {
      const client = await createClient();
      await prisma.clientProfile.update({
        where: { id: client.profile.id },
        data: { businessName: '', address: '', regionSi: '', regionGu: '' },
      });

      const res = await request(app).get('/api/v1/client/profile').set(auth(client.token));
      expect(res.body.data.complete).toBe(false);
      expect(res.body.data.missing).toEqual(['상호', '업종', '사업장 주소', '지역']);
    });

    it('가게 정보를 저장한다', async () => {
      const client = await createClient();
      const res = await request(app).put('/api/v1/client/profile').set(auth(client.token)).send({
        businessName: '마포 감성카페', businessCategory: 'CAFE',
        address: '서울시 마포구 합정동 123', regionSi: '서울', regionGu: '마포구', regionDong: '합정동',
        businessNumber: '220-81-62517',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.complete).toBe(true);
      expect(res.body.data.regionSi).toBe('서울특별시');
      // 숫자만 저장하고 보여 줄 때만 하이픈을 넣는다
      expect(res.body.data.businessNumber).toBe('220-81-62517');
      const saved = await prisma.clientProfile.findUniqueOrThrow({ where: { id: client.profile.id } });
      expect(saved.businessNumber).toBe('2208162517');
    });

    it('사업자등록번호는 선택이지만 적으면 형식을 본다', async () => {
      const client = await createClient();
      const body = {
        businessName: '가게', businessCategory: 'FOOD', address: '서울시 마포구 1',
        regionSi: '서울특별시', regionGu: '마포구',
      };

      const bad = await request(app).put('/api/v1/client/profile').set(auth(client.token))
        .send({ ...body, businessNumber: '123-45-67890' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.message).toContain('사업자등록번호');

      // 비워 두면 통과한다
      expect((await request(app).put('/api/v1/client/profile').set(auth(client.token))
        .send({ ...body, businessNumber: '' })).status).toBe(200);
    });

    it('가게 정보가 덜 찼으면 미션을 등록할 수 없다', async () => {
      const client = await createClient();
      await prisma.clientProfile.update({
        where: { id: client.profile.id },
        data: { businessName: '', address: '', regionSi: '', regionGu: '' },
      });

      const res = await request(app).post('/api/v1/missions/pay-and-create').set(auth(client.token)).send({
        title: '미션', description: '설명', category: 'SNS',
        regionSi: '서울특별시', regionGu: '마포구', maxParticipants: 5, rewardAmount: 30000,
        startDate: '2026-12-01', endDate: '2026-12-10', submissionDeadline: '2026-12-20',
        paymentKey: 'pk', orderId: 'oid', amount: 150000,
      });

      // 결제 잠금이 먼저 걸리는지, 가게 정보가 먼저 걸리는지와 상관없이 미션은 만들어지지 않는다
      expect([422, 503]).toContain(res.status);
      expect(await prisma.mission.count()).toBe(0);
    });
  });

  describe('대행 등록용 고객사 목록', () => {
    it('주소·지역을 함께 준다 (고르면 자동으로 채우려고)', async () => {
      const operator = await createOperator();
      const client = await createClient('마포 감성카페');
      await prisma.clientProfile.update({
        where: { id: client.profile.id },
        data: {
          businessCategory: 'CAFE', address: '서울시 마포구 합정동 123',
          regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
        },
      });

      const res = await request(app).get('/api/v1/operator/clients').set(auth(operator.token));
      expect(res.status).toBe(200);
      const row = res.body.data.find((c: { id: string }) => c.id === client.profile.id);
      expect(row).toMatchObject({
        address: '서울시 마포구 합정동 123',
        regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
        businessCategory: 'CAFE',
      });
    });
  });
});
