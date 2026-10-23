'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import { reloadOnceForChunkError } from '@/lib/chunk-reload';

/** 레이아웃까지 깨지는 오류일 때 보이는 화면. 오류는 모니터링으로 보낸다 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // 배포 직후 예전 화면이 새 파일을 못 찾는 오류는 오류 화면 대신 한 번 새로고침한다
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (reloadOnceForChunkError(error)) { setReloading(true); return; }
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-screen items-center justify-center bg-cream">
        <div className="p-8 text-center">
          {reloading ? (
            <p className="text-sm text-muted">새 버전을 불러오는 중입니다…</p>
          ) : (
            <>
              <p className="mb-2 font-serif text-section font-bold text-ink">문제가 생겼습니다</p>
              <p className="mb-6 text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
              <button onClick={reset} className="rounded-control bg-ink px-4 py-2 text-sm font-medium text-paper">
                다시 시도
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
