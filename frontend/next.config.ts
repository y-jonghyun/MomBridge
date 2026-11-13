import type { NextConfig } from 'next';

const config: NextConfig = {
  env: {
    // 화면 전환 움직임 (lib/page-transitions.ts). 값을 주면 그 값, 비우면 Vercel 프리뷰에서만 켠다
    NEXT_PUBLIC_PAGE_TRANSITIONS:
      process.env.NEXT_PUBLIC_PAGE_TRANSITIONS ?? (process.env.VERCEL_ENV === 'preview' ? 'on' : 'off'),
  },
  async headers() {
    return [
      {
        // 저장소에 넣은 글꼴 조각 — 파일 이름에 내용이 묶여 있어(Google 파일 이름 그대로) 오래 캐시해도 안전하다.
        // 이전 next/font의 /_next/static/media 파일과 같은 캐시 정책
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // 서비스워커는 항상 새로 받아야 배포가 바로 반영된다
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};
export default config;
