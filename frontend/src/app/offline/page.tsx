import type { Metadata } from 'next';
import RetryButton from './RetryButton';

export const metadata: Metadata = {
  title: '연결 없음 — 맘브릿지',
  robots: { index: false },
};

/**
 * 네트워크 없이 페이지를 열면 서비스워커(public/sw.js)가 이 화면을 대신 보여 준다.
 * 로그인 없이 그려지고, 데이터를 부르지 않는다 (설치 때 미리 받아 두는 화면).
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-client flex-col items-center justify-center px-5 py-16 text-center">
      <p className="font-accent text-lg italic text-clay">Offline</p>
      <h1 className="mt-2 font-serif text-title font-bold text-ink">인터넷 연결을 확인해주세요</h1>
      <p className="mt-3 break-keep text-[15px] leading-relaxed text-ink-2">
        지금은 네트워크에 연결되어 있지 않아요.
        <br />
        와이파이나 데이터 연결을 확인한 뒤 다시 시도해 주세요.
      </p>
      <RetryButton />
    </main>
  );
}
