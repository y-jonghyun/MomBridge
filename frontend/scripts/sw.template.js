/* 맘브릿지 서비스워커 — 설치 가능 + 오프라인 안내 단계.
 *
 * 하는 일은 두 가지뿐이다.
 *   1) 페이지 이동이 네트워크 오류로 실패하면 /offline 안내 화면을 보여 준다 (페이지 HTML은 저장하지 않는다)
 *   2) 파일명에 해시가 붙은 /_next/static/* 와 아이콘은 한 번 받으면 캐시에서 꺼내 쓴다
 *
 * 그 밖의 모든 요청(API·Supabase·로그인·GET이 아닌 요청·다른 origin)은 손대지 않고 네트워크로 보낸다.
 * respondWith를 부르지 않으면 브라우저가 원래대로 처리한다.
 *
 * 이 파일은 원본(템플릿)이다. public/sw.js 는 빌드할 때 scripts/build-sw.mjs 가 만든다 (커밋하지 않는다).
 * VERSION은 빌드마다 커밋 해시 + 빌드 시각으로 바뀐다 — 배포할 때마다 서비스워커가 갱신되고,
 * 예전 캐시는 activate에서 지운다. 손으로 올릴 필요가 없다.
 */
const VERSION = '__SW_VERSION__';
const PAGES = `mb-offline-${VERSION}`;
const STATIC = `mb-static-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
];
/** 배포가 쌓여도 정적 캐시가 끝없이 커지지 않게 */
const STATIC_LIMIT = 300;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    const statics = await caches.open(STATIC);
    const res = await fetch(OFFLINE_URL, { cache: 'reload' });
    if (!res.ok) throw new Error(`offline page ${res.status}`);
    // 오프라인 화면이 쓰는 JS·CSS·글꼴도 함께 받아 둬야 네트워크 없이 제대로 그려진다
    const html = await res.clone().text();
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
    await pages.put(OFFLINE_URL, res);
    await statics.addAll([...PRECACHE, ...assets]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, STATIC]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('mb-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico'
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - STATIC_LIMIT;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // 다른 origin(Render API, Supabase, 글꼴 CDN 등)은 그대로 통과
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // network-first: 응답은 저장하지 않는다 (로그인한 사람의 화면이 캐시에 남지 않게)
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match(OFFLINE_URL, { cacheName: PAGES });
        return cached ?? Response.error();
      }
    })());
    return;
  }

  if (isCacheableStatic(url)) {
    // cache-first: 해시 파일명이라 내용이 바뀌면 주소도 바뀐다
    event.respondWith((async () => {
      const cache = await caches.open(STATIC);
      const cached = await cache.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      if (res.ok && res.type === 'basic') {
        event.waitUntil(cache.put(request, res.clone()).then(() => trim(cache)));
      }
      return res;
    })());
  }
  // 나머지(RSC 데이터 요청, 같은 origin의 /api 등)는 손대지 않는다
});
