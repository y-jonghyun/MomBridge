'use client';

/** 원래 가려던 주소를 다시 연다 — 서비스워커가 같은 주소에 이 화면을 대신 보여 준 것이라 새로고침이면 된다 */
export default function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-8 h-[52px] w-full max-w-xs rounded-control-lg bg-clay text-base font-bold text-paper"
    >
      다시 시도
    </button>
  );
}
