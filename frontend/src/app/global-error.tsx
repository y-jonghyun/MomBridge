'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/** 레이아웃까지 깨지는 오류일 때 보이는 화면. 오류는 모니터링으로 보낸다 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="ko">
      <body className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center p-8">
          <p className="text-lg font-bold text-gray-800 mb-2">문제가 생겼습니다</p>
          <p className="text-sm text-gray-500 mb-6">잠시 후 다시 시도해 주세요.</p>
          <button onClick={reset} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">다시 시도</button>
        </div>
      </body>
    </html>
  );
}
