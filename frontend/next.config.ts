import type { NextConfig } from 'next';

const config: NextConfig = {
  async headers() {
    return [
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
