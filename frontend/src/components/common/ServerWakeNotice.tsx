'use client';
import { useEffect, useState } from 'react';
import { onSlowRequest } from '@/lib/api';

/** 요청이 몇 초 넘게 걸리면(서버가 잠에서 깨는 중) 화면 아래에 안내를 띄운다 */
export default function ServerWakeNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequest(setSlow), []);
  if (!slow) return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <span>서버를 준비하고 있어요. 처음 접속하면 최대 1분쯤 걸릴 수 있어요.</span>
      </div>
    </div>
  );
}
