import request from 'supertest';
import app from '../../src/app';
import { describeDb, resetDb, prisma } from '../helpers/db';
import { createClient, createMission, createOperator, createParticipant, createTrackingLink } from '../helpers/factory';

/**
 * 고객사에게 내려가는 응답에 화면이 쓰지 않는 체험단원 개인정보가 섞이지 않는지 지킨다.
 * select를 다시 include로 되돌리면(또는 필드를 늘리면) 여기서 실패해야 한다.
 */
describeDb('고객사 응답의 체험단원 정보 범위', () => {
  let token: string;
  let missionId: string;
  const participantEmailParts: string[] = [];

  beforeAll(async () => {
    await resetDb();
    const client = await createClient();
    token = client.token;
    const mission = await createMission(client.profile.id);
    missionId = mission.id;

    const participant = await createParticipant('홍길동');
    participantEmailParts.push(participant.user.email);
    // 노출되면 안 되는 값을 프로필에 심어 둔다
    await prisma.participantProfile.update({
      where: { id: participant.profile.id },
      data: { bio: '자기소개-노출금지', regionDong: '망원동', totalEarned: 123456, missionCount: 7, rating: 4.5 },
    });
    await prisma.user.update({ where: { id: participant.user.id }, data: { phone: '01000009999' } });
    // SNS 주소는 선정된 뒤 제출물로만 고객사에 보인다 — 지원 단계에서는 운영자만 본다
    await prisma.snsAccount.deleteMany({ where: { profileId: participant.profile.id } });
    await prisma.snsAccount.create({
      data: {
        profileId: participant.profile.id, platform: 'INSTAGRAM',
        handle: 'sns-노출금지', url: 'https://instagram.com/sns-노출금지',
      },
    });

    const { application, link } = await createTrackingLink(mission.id, participant.profile.id);
    await prisma.application.update({ where: { id: application.id }, data: { message: '지원메시지-노출금지' } });
    await prisma.submission.create({
      data: {
        missionId: mission.id, participantId: participant.profile.id, applicationId: application.id,
        status: 'APPROVED', description: '제출설명', snsPostUrl: 'https://blog.example/post',
        reviewNote: '검수메모-노출금지', mediaUrls: ['https://files.example/photo.jpg'],
      } as never,
    });
    void link;
  });
  afterAll(() => prisma.$disconnect());

  const get = (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it('지원 목록은 수를 세는 데 필요한 것만 준다 (지원자 개인정보 없음)', async () => {
    const res = await get(`/api/v1/client/missions/${missionId}/applications`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'status']);
  });

  it('제출 목록은 작성자 이름·상태·설명·게시글 주소만 준다', async () => {
    const res = await get(`/api/v1/client/missions/${missionId}/submissions`);
    expect(res.status).toBe(200);
    const [row] = res.body.data;
    expect(Object.keys(row).sort()).toEqual(['description', 'id', 'participant', 'snsPostUrl', 'status']);
    // 이름은 가려서 내려온다 (서버가 바꿔서 보낸다)
    expect(row.participant).toEqual({ user: { name: '홍○동' } });
    expect(row.snsPostUrl).toBe('https://blog.example/post');
  });

  it('성과 리포트 순위는 이름·게시글 주소·집계만 준다', async () => {
    const res = await get(`/api/v1/client/missions/${missionId}/report`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.ranking[0]).sort())
      .toEqual(['clicks', 'disclosure', 'linkCode', 'participantName', 'postUrl', 'uniqueVisitors']);
    // 고객사 경로도 가린 이름으로 내려준다 (운영자 경로만 실명)
    expect(res.body.data.ranking[0].participantName).toBe('홍○동');
  });

  it('운영자 경로에는 실명이 그대로 내려간다', async () => {
    const operator = await createOperator();
    const res = await request(app).get(`/api/v1/client/missions/${missionId}/report`)
      .set('Authorization', `Bearer ${operator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ranking[0].participantName).toBe('홍길동');
  });

  it('세 응답 어디에도 연락처·이메일·프로필·검수 메모가 섞이지 않는다', async () => {
    const bodies = await Promise.all([
      get(`/api/v1/client/missions/${missionId}/applications`),
      get(`/api/v1/client/missions/${missionId}/submissions`),
      get(`/api/v1/client/missions/${missionId}/report`),
    ]);
    const all = bodies.map(b => JSON.stringify(b.body)).join('\n');
    for (const leaked of [
      '홍길동',                   // 체험단원 실명 (고객사에게는 가린 이름만)
      '01000009999',              // 휴대폰 번호 (숫자만 저장)
      '010-0000-9999',            // 하이픈을 붙여 내보내는 경우도 막는다
      '0000-9999',                // 마스킹한 형태(010-****-9999)로도 나가면 안 된다
      ...participantEmailParts,   // 이메일
      '자기소개-노출금지',
      '지원메시지-노출금지',
      '검수메모-노출금지',
      '망원동',                   // 동 단위 거주 지역
      'sns-노출금지',             // SNS 계정 주소·아이디
      'instagram.com',            // SNS 채널 주소
      '123456',                   // 누적 보상 금액
      'files.example',            // 업로드 파일 주소
    ]) {
      expect(all).not.toContain(leaked);
    }
  });
});
