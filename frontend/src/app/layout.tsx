import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Gowun_Batang, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import ServerWakeNotice from '@/components/common/ServerWakeNotice';

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
  title: '맘브릿지 — 지역 마케팅 미션 플랫폼',
  description: '소상공인과 지역 주민을 연결하는 하이퍼로컬 미션 매칭 플랫폼',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <ServerWakeNotice />
      </body>
    </html>
  );
}
