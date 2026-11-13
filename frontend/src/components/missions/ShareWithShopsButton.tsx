'use client';
import { useState } from 'react';
import { ShareIcon } from '@/components/ui/icons';
import { SITE_URL } from '@/lib/site';

/**
 * '단골 가게에 알리기' — 가게용 소개 페이지(/for-shops) 주소를 휴대폰 공유 창으로 보낸다.
 * 출시 초기에는 가게가 먼저 들어와야 미션이 생기므로, 빈 미션 목록의 주 행동으로 둔다.
 *
 * - 공유 창이 있으면(대부분의 휴대폰) 그것을 연다. 사용자가 닫으면 아무 일도 하지 않는다.
 * - 없으면(데스크톱 등) 주소를 복사하고 "복사했어요"를 알린다.
 * - 복사도 안 되면 주소를 그대로 보여 줘 손으로 복사할 수 있게 한다.
 */
export const FOR_SHOPS_URL = `${SITE_URL}/for-shops`;
const SHARE_TEXT = '동네 엄마들이 가게에 들러 체험하고 솔직한 후기를 남겨 주는 맘브릿지예요. 사장님 가게도 한번 살펴보세요.';

type Status = 'idle' | 'copied' | 'manual';

export default function ShareWithShopsButton({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<Status>('idle');

  async function share() {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: '맘브릿지 — 사장님 안내', text: SHARE_TEXT, url: FOR_SHOPS_URL });
        return;
      } catch (err) {
        // 사용자가 공유 창을 닫은 것 — 그대로 둔다
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await nav?.clipboard?.writeText(FOR_SHOPS_URL);
      if (!nav?.clipboard) throw new Error('no clipboard');
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }

  return (
    <div className={className}>
      <button
        type="button" onClick={share}
        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-control bg-clay text-[15px] font-bold text-paper"
      >
        <ShareIcon size={17} strokeWidth={1.8} />
        단골 가게에 알리기
      </button>
      <p role="status" className={status === 'idle' ? 'sr-only' : 'mt-2 break-all text-[13px] text-muted'}>
        {status === 'copied' && '가게 안내 주소를 복사했어요. 사장님께 보내 주세요.'}
        {status === 'manual' && <>이 주소를 사장님께 보내 주세요: <span className="select-all text-ink-2">{FOR_SHOPS_URL}</span></>}
      </p>
    </div>
  );
}
