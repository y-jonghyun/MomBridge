import type { Metadata, Viewport } from 'next';
import PageTransition from '@/components/PageTransition';
import './fonts.css';
import './globals.css';
import ServerWakeNotice from '@/components/common/ServerWakeNotice';
import LogoutNotice from '@/components/ui/LogoutNotice';
import { SITE_URL, THEME_COLOR } from '@/lib/site';
import { DISPLAY_MODE_SCRIPT } from '@/lib/display-mode';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';
import InstallPrompt from '@/components/common/InstallPrompt';

// 디자인 기준: docs/design/mombridge-design/cream-editorial-v1.md
// 글꼴(Noto Sans KR · Gowun Batang · Cormorant Garamond)은 저장소에 넣어 둔 조각을 fonts.css로 쓴다 —
// 빌드 때 외부(Google Fonts)에서 받지 않는다. 다시 받거나 굵기를 바꿀 때는 scripts/fetch-fonts.mjs

export const metadata: Metadata = {
  // 소개 페이지의 공유 카드가 절대 주소를 갖게 한다
  metadataBase: new URL(SITE_URL),
  title: '맘브릿지 — 지역 마케팅 미션 플랫폼',
  description: '소상공인과 지역 주민을 연결하는 하이퍼로컬 미션 매칭 플랫폼',
  // 홈 화면 설치 (PWA) — manifest는 app/manifest.ts, 아이콘 원본은 public/icons/icon-source*.svg
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 설치 앱이면 첫 화면이 그려지기 전에 <html data-display="standalone"> (lib/display-mode.ts) */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_MODE_SCRIPT }} />
        <link rel="preconnect" href="https://mombridge-backend.onrender.com" />
        <link rel="dns-prefetch" href="https://mombridge-backend.onrender.com" />
      </head>
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        <PageTransition>{children}</PageTransition>
        <LogoutNotice />
        <ServerWakeNotice />
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
