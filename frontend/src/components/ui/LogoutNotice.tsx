'use client';
import { useEffect, useState } from 'react';
import { LOGOUT_NOTICE_KEY } from '@/store/auth';

/**
 * 로그아웃한 뒤 홈에서 한 번만 뜨는 짧은 안내.
 * store/auth.ts의 logout()이 남겨 둔 표시를 읽고 바로 지운다.
 */
export default function LogoutNotice() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let left = false;
    try {
      left = sessionStorage.getItem(LOGOUT_NOTICE_KEY) === '1';
      if (left) sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
    } catch { /* 저장소를 막아 둔 브라우저에서는 안내를 건너뛴다 */ }
    if (!left) return;
    setShown(true);
    const timer = setTimeout(() => setShown(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!shown) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[84px] z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-5 py-3 text-sm text-paper"
    >
      로그아웃했어요
    </div>
  );
}
