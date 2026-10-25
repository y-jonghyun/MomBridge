import type { Metadata } from 'next';
import HomeView from '@/components/home/HomeView';

/**
 * 루트. 처음 온 사람에게는 소개 화면, 로그인한 사람에게는 미션 중심 홈을 보여 준다
 * (갈림길은 HomeView 안에 있다 — 로그인 상태는 브라우저에서만 알 수 있다).
 *
 * 이 파일은 메타데이터를 내보내려고 서버 컴포넌트로 둔다.
 */
export const metadata: Metadata = {
  title: '맘브릿지 — 아이 등원 후 두 시간, 우리 동네에서 내 일이 생겨요',
  description:
    '집 근처 가게에 들러 체험하고, 솔직한 후기를 남기면 보상을 받아요. 출퇴근도, 면접도 없어요. 우리 동네 미션을 둘러보세요.',
  openGraph: {
    title: '아이 등원 후 두 시간, 우리 동네에서 내 일이 생겨요',
    description: '집 근처 가게를 체험하고 후기를 남기면 보상을 받는 동네 미션. 맘브릿지.',
    url: '/',
    siteName: '맘브릿지',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function HomePage() {
  return <HomeView />;
}
