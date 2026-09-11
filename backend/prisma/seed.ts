import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시드 데이터 삽입 시작...');

  // 기존 테스트 데이터 정리 (운영자 계정 제외)
  await prisma.payout.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.missionTag.deleteMany({});
  await prisma.mission.deleteMany({});
  await prisma.clientProfile.deleteMany({ where: { user: { email: { not: 'jh-90@naver.com' } } } });
  await prisma.participantProfile.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: 'jh-90@naver.com' } } });

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // ── 참여자 3명 생성 ──────────────────────────────────────────
  const [p1, p2, p3] = await Promise.all([
    prisma.user.create({ data: { email: 'mom1@test.com', passwordHash: await hash('test1234'), name: '김지수', role: 'PARTICIPANT' } }),
    prisma.user.create({ data: { email: 'mom2@test.com', passwordHash: await hash('test1234'), name: '이하은', role: 'PARTICIPANT' } }),
    prisma.user.create({ data: { email: 'mom3@test.com', passwordHash: await hash('test1234'), name: '박서연', role: 'PARTICIPANT' } }),
  ]);

  const [pp1, pp2, pp3] = await Promise.all([
    prisma.participantProfile.create({ data: { userId: p1.id, regionSi: '서울시', regionGu: '마포구', bio: '육아맘 블로거' } }),
    prisma.participantProfile.create({ data: { userId: p2.id, regionSi: '서울시', regionGu: '강남구', bio: '인스타 팔로워 2천명' } }),
    prisma.participantProfile.create({ data: { userId: p3.id, regionSi: '서울시', regionGu: '송파구', bio: '맛집 탐방 블로거' } }),
  ]);

  // ── 고객사 2명 생성 ──────────────────────────────────────────
  const [c1, c2] = await Promise.all([
    prisma.user.create({ data: { email: 'cafe1@test.com', passwordHash: await hash('test1234'), name: '홍길동', role: 'CLIENT' } }),
    prisma.user.create({ data: { email: 'bakery1@test.com', passwordHash: await hash('test1234'), name: '김빵순', role: 'CLIENT' } }),
  ]);

  const [cp1, cp2] = await Promise.all([
    prisma.clientProfile.create({ data: { userId: c1.id, businessName: '마포 감성카페 브루잉', category: '카페', address: '서울시 마포구 합정동 123', regionSi: '서울시', regionGu: '마포구', contactPhone: '02-1234-5678' } }),
    prisma.clientProfile.create({ data: { userId: c2.id, businessName: '강남 수제 베이커리', category: '베이커리', address: '서울시 강남구 논현동 456', regionSi: '서울시', regionGu: '강남구', contactPhone: '02-9876-5432' } }),
  ]);

  // ── 미션 5개 (다양한 상태) ────────────────────────────────────
  const base = new Date();
  const d = (days: number) => new Date(base.getTime() + days * 86400000);

  const m1 = await prisma.mission.create({ data: {
    clientProfileId: cp1.id, title: '마포 감성카페 방문 후 인스타 업로드', description: '우리 카페를 방문하고 분위기 사진을 인스타그램에 업로드해주세요. #마포카페 #브루잉 태그 필수입니다.',
    category: 'SNS', status: 'OPEN', regionSi: '서울시', regionGu: '마포구',
    rewardAmount: 30000, maxParticipants: 5, currentCount: 2,
    startDate: d(-3), endDate: d(14), submissionDeadline: d(17),
    requirements: '인스타그램 팔로워 300명 이상\n게시물 48시간 이상 유지',
  }});

  const m2 = await prisma.mission.create({ data: {
    clientProfileId: cp1.id, title: '카페 신메뉴 시음 후 블로그 리뷰', description: '신메뉴 시그니처 라떼와 계절 케이크를 무료로 드시고 블로그에 솔직한 리뷰를 작성해주세요.',
    category: 'REVIEW', status: 'REVIEWING', regionSi: '서울시', regionGu: '마포구',
    rewardAmount: 50000, maxParticipants: 3, currentCount: 3,
    startDate: d(-10), endDate: d(-1), submissionDeadline: d(3),
    requirements: '네이버 블로그 또는 티스토리 운영자',
  }});

  const m3 = await prisma.mission.create({ data: {
    clientProfileId: cp2.id, title: '강남 베이커리 방문 인증', description: '빵집에 방문해서 구매 인증 사진을 찍어주세요. 영수증 포함 사진 첨부 필수.',
    category: 'VISIT', status: 'OPEN', regionSi: '서울시', regionGu: '강남구',
    rewardAmount: 20000, maxParticipants: 10, currentCount: 1,
    startDate: d(-1), endDate: d(20), submissionDeadline: d(23),
  }});

  const m4 = await prisma.mission.create({ data: {
    clientProfileId: cp2.id, title: '베이커리 유튜브 쇼츠 제작', description: '빵 만들기 과정 또는 카페 분위기를 1분 내외 쇼츠로 제작해 유튜브에 업로드해주세요.',
    category: 'VIDEO', status: 'DRAFT', regionSi: '서울시', regionGu: '강남구',
    rewardAmount: 80000, maxParticipants: 2, currentCount: 0,
    startDate: d(7), endDate: d(37), submissionDeadline: d(40),
  }});

  const m5 = await prisma.mission.create({ data: {
    clientProfileId: cp1.id, title: '카페 오픈 기념 SNS 이벤트', description: '리그랜드 오픈을 맞아 카페 방문 후 SNS에 홍보 게시물을 올려주세요.',
    category: 'SNS', status: 'CLOSED', regionSi: '서울시', regionGu: '마포구',
    rewardAmount: 25000, maxParticipants: 5, currentCount: 5,
    startDate: d(-30), endDate: d(-10), submissionDeadline: d(-7),
  }});

  // ── 지원서 (Applications) ─────────────────────────────────────
  // m1(OPEN): pp1 승인, pp2 승인, pp3 대기
  const a1 = await prisma.application.create({ data: { missionId: m1.id, participantId: pp1.id, status: 'APPROVED', message: '인스타 팔로워 500명 운영 중입니다!' } });
  const a2 = await prisma.application.create({ data: { missionId: m1.id, participantId: pp2.id, status: 'APPROVED', message: '카페 콘텐츠 전문으로 올리고 있어요.' } });
  const a3 = await prisma.application.create({ data: { missionId: m1.id, participantId: pp3.id, status: 'PENDING', message: '마포구 거주중입니다.' } });

  // m2(REVIEWING): 3명 모두 승인
  const a4 = await prisma.application.create({ data: { missionId: m2.id, participantId: pp1.id, status: 'APPROVED', message: '네이버 블로그 3년 운영 중' } });
  const a5 = await prisma.application.create({ data: { missionId: m2.id, participantId: pp2.id, status: 'APPROVED', message: '티스토리 월 방문자 2천명' } });
  const a6 = await prisma.application.create({ data: { missionId: m2.id, participantId: pp3.id, status: 'APPROVED', message: '카페/베이커리 리뷰 전문' } });

  // m3(OPEN): pp2 승인, pp1 대기
  const a7 = await prisma.application.create({ data: { missionId: m3.id, participantId: pp2.id, status: 'APPROVED', message: '강남 자주 다닙니다.' } });
  const a8 = await prisma.application.create({ data: { missionId: m3.id, participantId: pp1.id, status: 'REJECTED', message: '참여하고 싶습니다!', rejectionReason: '강남구 거주자 우선 선발' } });

  // ── 제출물 (Submissions) ──────────────────────────────────────
  // m1: pp1 제출완료, pp2 승인
  const s1 = await prisma.submission.create({ data: {
    missionId: m1.id, applicationId: a1.id, participantId: pp1.id,
    status: 'SUBMITTED', description: '마포 브루잉 카페 방문했습니다! 분위기 너무 좋아요 ☕',
    snsPostUrl: 'https://instagram.com/p/test001',
  }});

  const s2 = await prisma.submission.create({ data: {
    missionId: m1.id, applicationId: a2.id, participantId: pp2.id,
    status: 'APPROVED', description: '오전에 방문해서 라떼랑 크루아상 먹었어요. 감성 최고!',
    snsPostUrl: 'https://instagram.com/p/test002',
    reviewNote: '사진 품질 좋음, 태그 정확히 포함',
    approvedAt: d(-1),
  }});

  // m2: 3명 모두 제출, 검수 대기
  const s3 = await prisma.submission.create({ data: {
    missionId: m2.id, applicationId: a4.id, participantId: pp1.id,
    status: 'SUBMITTED', description: '블로그에 시그니처 라떼 리뷰 작성 완료했습니다.',
    snsPostUrl: 'https://blog.naver.com/test/001',
  }});

  const s4 = await prisma.submission.create({ data: {
    missionId: m2.id, applicationId: a5.id, participantId: pp2.id,
    status: 'SUBMITTED', description: '계절 케이크 솔직 리뷰 올렸어요. 비주얼 대박!',
    snsPostUrl: 'https://tistory.com/entry/test',
  }});

  const s5 = await prisma.submission.create({ data: {
    missionId: m2.id, applicationId: a6.id, participantId: pp3.id,
    status: 'REVISION', description: '방문 후 사진 찍어서 올렸습니다.',
    reviewNote: '해시태그 누락, 사진 추가 요청',
    rejectionReason: '#브루잉 태그 추가 후 재제출 요청',
  }});

  // m3: pp2 제출
  const s6 = await prisma.submission.create({ data: {
    missionId: m3.id, applicationId: a7.id, participantId: pp2.id,
    status: 'APPROVED', description: '강남 베이커리 방문! 크림치즈 베이글 구매 인증합니다.',
    approvedAt: d(-2),
  }});

  // ── 정산 (Payouts) ────────────────────────────────────────────
  // s2 승인됨 → 정산 대기
  await prisma.payout.create({ data: {
    submissionId: s2.id, participantId: pp2.id,
    amount: 30000, platformFee: 3000, netAmount: 27000,
    status: 'PENDING',
  }});

  // s6 승인됨 → 정산 완료
  await prisma.payout.create({ data: {
    submissionId: s6.id, participantId: pp2.id,
    amount: 20000, platformFee: 2000, netAmount: 18000,
    status: 'COMPLETED', completedAt: d(-1),
  }});

  console.log('✅ 시드 완료!');
  console.log('');
  console.log('── 테스트 계정 ─────────────────────');
  console.log('참여자1: mom1@test.com / test1234  (김지수)');
  console.log('참여자2: mom2@test.com / test1234  (이하은)');
  console.log('참여자3: mom3@test.com / test1234  (박서연)');
  console.log('고객사1: cafe1@test.com / test1234  (마포 감성카페 브루잉)');
  console.log('고객사2: bakery1@test.com / test1234  (강남 수제 베이커리)');
  console.log('');
  console.log('── 미션 현황 ───────────────────────');
  console.log('OPEN    : 마포 감성카페 방문 후 인스타 업로드');
  console.log('OPEN    : 강남 베이커리 방문 인증');
  console.log('REVIEWING: 카페 신메뉴 시음 후 블로그 리뷰');
  console.log('DRAFT   : 베이커리 유튜브 쇼츠 제작');
  console.log('CLOSED  : 카페 오픈 기념 SNS 이벤트');
}

main()
  .catch(e => { console.error('❌ 오류:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
