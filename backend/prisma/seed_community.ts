import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany({ where: { role: 'PARTICIPANT' }, take: 3 });
  if (!users.length) { console.log('참여자 없음'); return; }

  await p.communityPost.createMany({
    data: [
      { userId: users[0].id, category: '체험후기', title: '마포 브루잉 카페 체험단 후기 🔥', content: '드디어 체험단 당첨돼서 다녀왔어요!\n\n카페 분위기가 너무 좋고 시그니처 라떼는 진짜 맛있었어요. 사진도 예쁘게 잘 나오고 인스타 업로드 후 검수도 빠르게 완료됐답니다.\n\n맘브릿지 처음 사용해봤는데 생각보다 쉽고 보상도 빠르게 처리돼서 좋았어요 👍', likeCount: 12, viewCount: 89 },
      { userId: users[1].id, category: '미션팁', title: 'SNS 체험단 사진 잘 찍는 방법 꿀팁 모음', content: '체험단 여러 번 하다 보니 노하우가 생겼어요!\n\n1. 자연광 활용하기 - 오전 10시~12시가 가장 좋아요\n2. 배경 깔끔하게 정리하기\n3. 음식은 받자마자 바로 촬영 (김 서리기 전에!)\n4. 세로/가로 다양하게 찍어두기\n5. 필터는 최소한으로, 자연스럽게\n\n처음엔 어렵지만 몇 번 하다보면 감이 잡혀요 😊', likeCount: 27, viewCount: 203 },
      { userId: users[2].id, category: '지역정보', title: '서울 마포구 맛집 체험단 많이 뜨는 편인가요?', content: '제가 마포구 사는데 체험단 잘 뜨는 지역인지 궁금해서요!\n\n합정, 홍대 쪽에 카페나 맛집이 많아서 체험단도 자주 올라올 것 같은데\n실제로 체험해보신 분들 계신가요?', likeCount: 5, viewCount: 41 },
      { userId: users[0].id, category: '자유게시판', title: '맘브릿지 쓰고 이번달 수익 공개 💰', content: '이번달 총 3개 미션 완료했고요\n\n1. 카페 SNS 미션 - 27,000원\n2. 베이커리 방문 인증 - 18,000원\n3. 레스토랑 리뷰 작성 - 45,000원\n\n합계: 90,000원!\n\n부업으로 완전 쏠쏠한 것 같아요 ㅎㅎ', likeCount: 34, viewCount: 312 },
      { userId: users[1].id, category: '질문', title: '체험단 신청 후 보통 얼마나 기다려야 하나요?', content: '처음 신청해봤는데 아직 연락이 없어서요...\n\n신청한지 3일 됐는데 보통 얼마나 기다려야 하는지 궁금합니다!\n\n거절되면 따로 알림이 오나요?', likeCount: 3, viewCount: 67 },
    ],
  });
  console.log('✅ 커뮤니티 게시글 5개 등록 완료');
}

main().catch(console.error).finally(() => p.$disconnect());
