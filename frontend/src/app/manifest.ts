import type { MetadataRoute } from 'next';
import { THEME_COLOR } from '@/lib/site';

/** /manifest.webmanifest 로 나간다 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '맘브릿지 — 지역 마케팅 미션 플랫폼',
    short_name: '맘브릿지',
    description: '소상공인과 지역 주민을 연결하는 하이퍼로컬 미션 매칭 플랫폼',
    lang: 'ko',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
