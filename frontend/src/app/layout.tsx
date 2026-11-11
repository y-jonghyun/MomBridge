import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Gowun_Batang, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import ServerWakeNotice from '@/components/common/ServerWakeNotice';
import LogoutNotice from '@/components/ui/LogoutNotice';
import { SITE_URL, THEME_COLOR } from '@/lib/site';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';
import InstallPrompt from '@/components/common/InstallPrompt';

// 디자인 기준: docs/design/mombridge-design/cream-editorial-v1.md
const sans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-sans',
});
const serif = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-serif',
});
/** 섹션 위 영문 머리말 한 줄에만 쓴다 (예: After drop-off) */
const accent = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500'],
  style: ['italic'],
  display: 'swap',
  variable: '--font-accent',
});

export const metadata: Metadata = {
  // 소개 페이지의 공유 카드가 절대 주소를 갖게 한다
  metadataBase: new URL(SITE_URL),
  title: '맘브릿지 — 지역 마케팅 미션 플랫폼',
  description: '소상공인과 지역 주민을 연결하는 하이퍼로컬 미션 매칭 플랫폼',
  // 홈 화면 설치 (PWA) — manifest는 app/manifest.ts, 아이콘 원본은 public/icons/icon-source.svg
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '맘브릿지', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: THEME_COLOR,
  // 노치·홈 막대 영역까지 그린다 — 하단 고정 막대는 env(safe-area-inset-bottom)만큼 띄운다
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${sans.variable} ${serif.variable} ${accent.variable}`}>
      <head>
        <link rel="preconnect" href="https://mombridge-backend.onrender.com" />
        <link rel="dns-prefetch" href="https://mombridge-backend.onrender.com" />
      </head>
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        {children}
        <LogoutNotice />
        <ServerWakeNotice />
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
