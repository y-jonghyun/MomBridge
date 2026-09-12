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
      </head>
      <body className="min-h-screen bg-stone-50 antialiased">{children}</body>
    </html>
  );
}
