import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator } from '../helpers/factory';
import { normalizeProvince, provinceVariants } from '../../src/lib/regions';

describe('normalizeProvince', () => {
  it('maps short and old spellings to the official name and rejects cities', () => {
    expect(normalizeProvince('충북')).toBe('충청북도');
    expect(normalizeProvince(' 충청 북도 ')).toBe('충청북도');
    expect(normalizeProvince('서울시')).toBe('서울특별시');
    expect(normalizeProvince('전라북도')).toBe('전북특별자치도');
    expect(normalizeProvince('강원도')).toBe('강원특별자치도');
    expect(normalizeProvince('청주시')).toBeNull();
    expect(provinceVariants('충청북도')).toEqual(['충청북도', '충북']);
  });
});

describeDb('지역 필터', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const missionBody = {
    title: '청주 카페', description: '설명', category: 'VISIT', regionGu: '청주시 상당구',
    maxParticipants: 3, rewardAmount: 20000, startDate: '2026-11-01', endDate: '2099-11-10', submissionDeadline: '2099-11-20',
  };

  it('stores the official province name and refuses a city in the province field', async () => {
    const op = await createOperator();
    const client = await createClient();
    const create = (regionSi: string) => request(app).post('/api/v1/missions').set('Authorization', `Bearer ${op.token}`)
      .send({ ...missionBody, regionSi, clientProfileId: client.profile.id });
    const ok = await create('충북');
    expect(ok.status).toBe(201);
    expect(ok.body.data.regionSi).toBe('충청북도');
    const bad = await create('청주시');
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('시·도를 선택');
  });

  it('finds missions saved with old spellings when filtering by province', async () => {
    const client = await createClient();
    const far = new Date(Date.now() + 30 * 86400000);
    for (const [title, regionSi] of [['정식', '충청북도'], ['약칭', '충북'], ['서울', '서울시'], ['다른 도', '충청남도']]) {
      await createMission(client.profile.id, { title, regionSi, endDate: far });
    }
    const titles = async (q: string) =>
      ((await request(app).get(`/api/v1/missions?regionSi=${encodeURIComponent(q)}`)).body.data.missions as { title: string }[])
        .map(m => m.title).sort();
    expect(await titles('충청북도')).toEqual(['약칭', '정식'].sort());
    expect(await titles('충북')).toEqual(['약칭', '정식'].sort());
    expect(await titles('서울특별시')).toEqual(['서울']);
  });
});
