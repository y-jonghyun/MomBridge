import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission } from '../helpers/factory';

describeDb('미션 상세', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('returns the keywords the client picked, main first, without internal search volumes', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id);
    await prisma.missionKeyword.createMany({
      data: [
        { missionId: mission.id, keyword: '망원동 브런치', role: 'SUB', monthlyPcQc: 300, monthlyMobileQc: 900 },
        { missionId: mission.id, keyword: '망원동카페', role: 'MAIN', monthlyPcQc: 1200, monthlyMobileQc: 5400 },
        { missionId: mission.id, keyword: '마포 디저트', role: 'SUB' },
      ],
    });
    const res = await request(app).get(`/api/v1/missions/${mission.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.keywords[0]).toEqual({ keyword: '망원동카페', role: 'MAIN' });
    expect(res.body.data.keywords.map((k: { keyword: string }) => k.keyword).sort()).toEqual(['마포 디저트', '망원동 브런치', '망원동카페'].sort());
    expect(JSON.stringify(res.body.data.keywords)).not.toContain('monthly');
  });

  it('returns an empty list when no keywords were chosen', async () => {
    const client = await createClient();
    const mission = await createMission(client.profile.id);
    expect((await request(app).get(`/api/v1/missions/${mission.id}`)).body.data.keywords).toEqual([]);
  });
});
