/** 저장소 호출을 가로채 어떤 파일이 지워졌는지 본다 */
const storageFiles = new Set<string>();
jest.mock('../../src/lib/storage', () => ({
  storageConfigured: () => true,
  publicUrl: (path: string) => `https://storage.test.example/${path}`,
  uploadObject: jest.fn(),
  deleteObject: jest.fn(async (path: string) => { storageFiles.delete(path); }),
}));

import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createParticipant, createTrackingLink } from '../helpers/factory';
import { clock } from '../../src/lib/clock';
import { deleteMissions, hideMissions, listMissions, staleUnpaidDrafts } from '../../src/modules/missions/mission-cleanup';

describeDb('미션 정리', () => {
  beforeEach(resetDb);
  afterEach(() => clock.set(null));
  afterAll(() => prisma.$disconnect());

  it('hides demo missions without deleting them', async () => {
    const client = await createClient();
    const demo = await createMission(client.profile.id, { title: '강남 베이커리', paymentStatus: 'WAIVED' });
    expect(await hideMissions([demo.id])).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({ where: { id: demo.id } });
    expect(row).toMatchObject({ isVisible: false, status: 'CLOSED' });
    expect(row.closedAt).not.toBeNull();
  });

  it('finds unpaid drafts older than N days only', async () => {
    const client = await createClient();
    const old = await createMission(client.profile.id, { status: 'DRAFT', paymentStatus: 'PENDING', createdAt: new Date('2026-09-01') });
    await createMission(client.profile.id, { status: 'DRAFT', paymentStatus: 'PENDING', createdAt: new Date('2026-10-20') });
    await createMission(client.profile.id, { status: 'DRAFT', paymentStatus: 'PAID', createdAt: new Date('2026-09-01') });
    await createMission(client.profile.id, { status: 'OPEN', paymentStatus: 'PENDING', createdAt: new Date('2026-09-01') });
    clock.set(() => new Date('2026-10-22T12:00:00+09:00'));
    expect(await staleUnpaidDrafts(14)).toEqual([old.id]);
  });

  it('deletes only missions without payment or submissions, together with applications and tracking data', async () => {
    const client = await createClient();
    const p = await createParticipant();
    const demo = await createMission(client.profile.id, { paymentStatus: 'WAIVED' });
    const { link } = await createTrackingLink(demo.id, p.profile.id);
    await prisma.clickEvent.create({ data: { linkId: link.id, dayKey: new Date('2026-10-01'), device: 'MOBILE', isBot: false, isUnique: true } as never });
    const paid = await createMission(client.profile.id, { paymentStatus: 'PAID' });
    const withSubmission = await createMission(client.profile.id, { paymentStatus: 'WAIVED' });
    const app = await prisma.application.create({ data: { missionId: withSubmission.id, participantId: p.profile.id, status: 'APPROVED' } });
    await prisma.submission.create({ data: { missionId: withSubmission.id, applicationId: app.id, participantId: p.profile.id, contentUrl: 'https://blog.naver.com/a/1' } as never });

    // 지워질 미션과 남을 미션에 각각 사진을 하나씩 둔다
    storageFiles.clear();
    for (const [mission, path] of [[demo, 'demo/a.webp'], [paid, 'paid/b.webp']] as const) {
      storageFiles.add(path);
      await prisma.missionImage.create({
        data: { missionId: mission.id, url: `https://storage.test.example/${path}`, storagePath: path, sortOrder: 0 },
      });
    }

    const result = await deleteMissions([demo.id, paid.id, withSubmission.id, '00000000-0000-4000-8000-000000000000']);
    expect(result.deleted).toEqual([demo.id]);
    // 지워진 미션의 사진 파일만 저장소에서 사라진다
    expect(result.imageFiles).toEqual({ removed: 1, failed: 0 });
    expect([...storageFiles]).toEqual(['paid/b.webp']);
    expect(await prisma.missionImage.count({ where: { missionId: demo.id } })).toBe(0);
    expect(result.refused.map(r => r.id)).toEqual([paid.id, withSubmission.id, '00000000-0000-4000-8000-000000000000']);
    expect(await prisma.mission.findUnique({ where: { id: demo.id } })).toBeNull();
    expect(await prisma.trackingLink.count({ where: { missionId: demo.id } })).toBe(0);
    expect(await prisma.clickEvent.count({ where: { linkId: link.id } })).toBe(0);
    expect((await listMissions()).map(m => m.id).sort()).toEqual([paid.id, withSubmission.id].sort());
  });
});
