import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '맘브릿지 — 지역 마케팅 미션 플랫폼',
  description: '소상공인과 지역 주민을 연결하는 하이퍼로컬 미션 매칭 플랫폼',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://mombridge-backend.onrender.com" />
        <link rel="dns-prefetch" href="https://mombridge-backend.onrender.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,500&family=Pinyon+Script&family=Noto+Sans+KR:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-cream text-ink font-sans font-light antialiased">{children}</body>
    </html>
  );
}
