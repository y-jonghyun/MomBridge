import request from 'supertest';
import sharp from 'sharp';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';
import { toWebp } from '../../src/modules/missions/mission-images';

/** 올라간 파일을 저장소 대신 메모리에 담아 두고 확인한다 */
const uploaded = new Map<string, Buffer>();

jest.mock('../../src/lib/storage', () => ({
  storageConfigured: () => true,
  publicUrl: (path: string) => `https://storage.test.example/${path}`,
  uploadObject: jest.fn(async (path: string, body: Buffer) => {
    uploaded.set(path, body);
    return `https://storage.test.example/${path}`;
  }),
  deleteObject: jest.fn(async (path: string) => { uploaded.delete(path); }),
}));

/** 테스트용 사진 한 장 (EXIF에 촬영 위치를 넣어 둔다) */
async function jpegWithExif(width = 2400, height = 1200) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 180, b: 160 } } })
    // sharp 타입이 아는 블록으로 EXIF를 심는다 (위치 정보도 같은 EXIF 블록에 들어가므로
    // '변환 후 EXIF가 통째로 사라지는지'를 보면 위치 제거도 함께 확인된다)
    .withMetadata({ exif: { IFD0: { Copyright: 'mombridge-test', Software: 'test-camera' } } })
    .jpeg()
    .toBuffer();
}

describeDb('미션 사진 업로드', () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  let other: Awaited<ReturnType<typeof createClient>>;
  let operator: Awaited<ReturnType<typeof createOperator>>;
  let participant: Awaited<ReturnType<typeof createParticipant>>;
  let missionId: string;

  beforeEach(async () => {
    await resetDb();
    uploaded.clear();
    client = await createClient('내 가게');
    other = await createClient('남의 가게');
    operator = await createOperator();
    participant = await createParticipant();
    const mission = await createMission(client.profile.id);
    missionId = mission.id;
  });
  afterAll(() => prisma.$disconnect());

  const post = (token: string, body: Buffer, name = 'photo.jpg', type = 'image/jpeg') =>
    request(app).post(`/api/v1/missions/${missionId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', body, { filename: name, contentType: type });

  it('미션 주인과 운영자만 올릴 수 있다', async () => {
    const photo = await jpegWithExif(800, 600);

    expect((await post(client.token, photo)).status).toBe(201);
    expect((await post(operator.token, photo)).status).toBe(201);

    // 남의 미션, 체험단원, 로그인 안 한 요청은 막는다
    expect((await post(other.token, photo)).status).toBe(403);
    expect((await post(participant.token, photo)).status).toBe(403);
    expect((await request(app).post(`/api/v1/missions/${missionId}/images`)
      .attach('image', photo, { filename: 'photo.jpg', contentType: 'image/jpeg' })).status).toBe(401);
  });

  it('jpg·png·webp가 아니면 거절한다', async () => {
    const res = await post(client.token, Buffer.from('%PDF-1.4 not an image'), 'doc.pdf', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_IMAGE');
    expect(await prisma.missionImage.count()).toBe(0);
  });

  it('5MB를 넘으면 거절한다', async () => {
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
    const res = await post(client.token, tooBig, 'big.jpg');
    expect(res.status).toBe(400);
    expect(await prisma.missionImage.count()).toBe(0);
  });

  it('6장째는 거절한다', async () => {
    const photo = await jpegWithExif(600, 400);
    for (let i = 0; i < 5; i++) expect((await post(client.token, photo)).status).toBe(201);

    const res = await post(client.token, photo);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_IMAGES');
    expect(await prisma.missionImage.count()).toBe(5);
  });

  it('저장한 사진에는 EXIF가 남지 않고 긴 변이 1600px로 줄어든다', async () => {
    const original = await jpegWithExif(2400, 1200);
    // 원본에는 EXIF가 들어 있다
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const converted = await toWebp(original);
    const meta = await sharp(converted).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
    expect(meta.exif).toBeUndefined();
  });

  it('첫 장이 대표 사진이 되고, 순서를 바꾸면 대표도 따라간다', async () => {
    const photo = await jpegWithExif(600, 400);
    const first = (await post(client.token, photo)).body.data;
    const second = (await post(client.token, photo)).body.data;

    const afterUpload = await prisma.mission.findUnique({ where: { id: missionId }, select: { thumbnailUrl: true } });
    expect(afterUpload?.thumbnailUrl).toBe(first.url);

    const res = await request(app).patch(`/api/v1/missions/${missionId}/images/order`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ imageIds: [second.id, first.id] });
    expect(res.status).toBe(200);

    const afterOrder = await prisma.mission.findUnique({ where: { id: missionId }, select: { thumbnailUrl: true } });
    expect(afterOrder?.thumbnailUrl).toBe(second.url);
  });

  it('지우면 저장소 파일도 함께 지운다', async () => {
    const photo = await jpegWithExif(600, 400);
    const image = (await post(client.token, photo)).body.data;
    const row = await prisma.missionImage.findUniqueOrThrow({ where: { id: image.id } });
    expect(uploaded.has(row.storagePath)).toBe(true);

    const res = await request(app).delete(`/api/v1/missions/${missionId}/images/${image.id}`)
      .set('Authorization', `Bearer ${client.token}`);
    expect(res.status).toBe(200);
    expect(uploaded.has(row.storagePath)).toBe(false);
    expect(await prisma.missionImage.count()).toBe(0);

    const after = await prisma.mission.findUnique({ where: { id: missionId }, select: { thumbnailUrl: true } });
    expect(after?.thumbnailUrl).toBeNull();
  });
});
