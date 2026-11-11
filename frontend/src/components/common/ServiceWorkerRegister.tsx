'use client';
import { useEffect } from 'react';

/**
 * public/sw.js 를 등록한다. 배포 빌드에서만 — 개발 중에는 캐시가 고친 코드를 가리지 않도록 등록하지 않는다.
 * 같은 localhost 주소에서 production 빌드를 띄워 본 뒤 dev로 돌아오면 그때 등록된 것이 남아 있으므로,
 * 개발 모드에서는 남은 서비스워커와 그 캐시를 지운다 (dev의 /_next/static 파일명에는 해시가 없어 옛 코드가 보인다).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => void r.unregister()));
      if ('caches' in window) void caches.keys().then(names => names.filter(n => n.startsWith('mb-')).forEach(n => void caches.delete(n)));
      return;
    }
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // 등록 실패는 앱 사용에 지장이 없다 — 설치·오프라인 안내만 빠진다
      });
    };
    // 첫 화면 로딩과 경쟁하지 않도록 load 이후에
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
