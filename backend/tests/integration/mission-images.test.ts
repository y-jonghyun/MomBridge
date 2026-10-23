import request from 'supertest';
import sharp from 'sharp';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant } from '../helpers/factory';
import { MAX_IMAGES, toWebp } from '../../src/modules/missions/mission-images';

/** 라우터의 업로드 횟수 제한과 같은 값 */
const UPLOAD_LIMIT = 30;

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

  const bare2 = (token: string) => request(app).post(`/api/v1/missions/${missionId}/images`)
    .set('Authorization', `Bearer ${token}`);

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

  it('5MB 이하라도 픽셀이 너무 많으면 거절한다 (압축 폭탄)', async () => {
    // 단색 PNG라 파일은 작지만 8000x6000 = 4800만 화소 — 풀어 놓으면 수백 MB다
    const bomb = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);

    const res = await post(client.token, bomb, 'bomb.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IMAGE_TOO_MANY_PIXELS');
    expect(await prisma.missionImage.count()).toBe(0);
    expect(uploaded.size).toBe(0); // 저장소까지 가지 않는다
  }, 30_000);

  it('동시에 올려도 5장을 넘지 않는다', async () => {
    const photo = await jpegWithExif(400, 300);
    const results = await Promise.all(Array.from({ length: 8 }, () => post(client.token, photo)));

    expect(results.filter(r => r.status === 201)).toHaveLength(MAX_IMAGES);
    expect(results.filter(r => r.status === 400 && r.body.error.code === 'TOO_MANY_IMAGES')).toHaveLength(3);
    expect(await prisma.missionImage.count()).toBe(MAX_IMAGES);

    // 자리를 얻지 못한 요청이 올린 파일은 저장소에 남지 않는다
    const rows = await prisma.missionImage.findMany({ select: { storagePath: true, sortOrder: true } });
    expect(uploaded.size).toBe(MAX_IMAGES);
    expect(rows.every(r => uploaded.has(r.storagePath))).toBe(true);
    expect([...rows].map(r => r.sortOrder).sort()).toEqual([0, 1, 2, 3, 4]);
  }, 30_000);

  it('권한이 없으면 파일을 읽기 전에 막는다', async () => {
    // 닫는 경계가 없는 망가진 multipart 본문. multer가 먼저 돌면 본문을 읽다 400이 나고,
    // 권한 확인이 먼저 돌면 본문을 읽지 않으므로 403이 난다
    const CRLF = '\r\n';
    const broken = `------X${CRLF}Content-Disposition: form-data; name="image"; filename="a.jpg"${CRLF}${CRLF}조각난 본문`;
    const send = (token: string) => request(app).post(`/api/v1/missions/${missionId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'multipart/form-data; boundary=----X')
      .send(broken);

    // 주인이 보내면 multer까지 가서 본문이 깨졌다는 400이 난다
    expect((await send(client.token)).status).toBe(400);
    // 남의 미션이면 본문을 읽기 전에 막힌다
    expect((await send(other.token)).status).toBe(403);
  }, 20_000);

  it('한 사람이 너무 많이 올리면 429로 막는다', async () => {
    // 제한은 파일을 읽기 전에 걸리므로, 파일 없이 보내도 횟수는 똑같이 센다
    const bare = () => request(app).post(`/api/v1/missions/${missionId}/images`)
      .set('Authorization', `Bearer ${client.token}`);

    for (let i = 0; i < UPLOAD_LIMIT; i++) {
      expect((await bare()).status).toBe(400); // 파일이 없어서 400 — 제한에는 걸리지 않았다
    }
    const over = await bare();
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('TOO_MANY_UPLOADS');

    // 다른 사람은 영향을 받지 않는다 (사용자별 제한)
    expect((await bare2(operator.token)).status).toBe(400);
  }, 60_000);

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
