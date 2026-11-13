'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, SearchIcon } from '@/components/ui/icons';
import { loadPostcode, toPickedAddress, type PickedAddress, type PostcodeCtor } from '@/lib/kakao-postcode';

/**
 * '주소 검색' 버튼 + 전체 화면 검색 창 (카카오 우편번호 서비스를 화면 안에 넣는다).
 *
 * 고르면 주소·시·도·시·군·구·동을 onPick으로 넘긴다. 칸은 그대로 손으로 고칠 수 있다.
 * 스크립트는 이 버튼이 화면에 나올 때 불러오고, 못 불러오면 버튼 대신 안내 한 줄만 보여 준다 —
 * 아래 입력칸에 직접 적으면 되니 등록이 막히지 않는다.
 *
 * 새 창(팝업) 대신 화면 안에 넣는 이유: 설치한 앱(standalone)에서 팝업은 앱 밖 브라우저로 열린다.
 */

// 우편번호 화면을 크림 바탕에 맞춘다 (tailwind.config 색과 같다)
const THEME = {
  bgColor: '#F6F1E8',
  searchBgColor: '#FFFDF8',
  contentBgColor: '#FFFDF8',
  pageBgColor: '#F6F1E8',
  textColor: '#211C16',
  queryTextColor: '#211C16',
  postcodeTextColor: '#A9572F',
  emphTextColor: '#7E3E1F',
  outlineColor: '#E6DCCD',
};

type LoadState = 'loading' | 'ready' | 'failed';

export default function AddressSearch({ onPick, className = '' }: {
  onPick: (picked: PickedAddress) => void;
  className?: string;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const [open, setOpen] = useState(false);
  const ctor = useRef<PostcodeCtor | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  // 부모가 매번 새 함수를 넘겨도 검색 창을 다시 그리지 않게 ref로 들고 있는다
  const pick = useRef(onPick);
  pick.current = onPick;
  // 주소를 고르고 닫을 때는 부모가 주소 칸으로 커서를 옮기므로 버튼으로 되돌리지 않는다
  const returnFocus = useRef(true);

  const load = () => {
    setState('loading');
    loadPostcode()
      .then(c => { ctor.current = c; setState('ready'); })
      .catch(() => setState('failed'));
  };
  useEffect(load, []);

  // 창이 열리면 우편번호 화면을 넣고, Esc로 닫는다
  useEffect(() => {
    if (!open || !ctor.current || !frame.current) return;
    const el = frame.current;
    el.innerHTML = '';
    new ctor.current({
      width: '100%',
      height: '100%',
      theme: THEME,
      oncomplete: data => {
        returnFocus.current = false;
        setOpen(false);
        pick.current(toPickedAddress(data));
      },
    }).embed(el, { autoClose: false });
    returnFocus.current = true;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (returnFocus.current) opener.current?.focus();
    };
  }, [open]);

  if (state === 'failed') {
    return (
      <p className={`flex flex-wrap items-center gap-x-2 break-keep text-xs leading-[1.6] text-muted ${className}`}>
        주소 검색을 불러오지 못했어요. 아래 칸에 직접 적어 주세요.
        <button type="button" onClick={load} className="min-h-[44px] font-medium text-clay underline underline-offset-2">
          다시 시도
        </button>
      </p>
    );
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        disabled={state !== 'ready'}
        onClick={() => setOpen(true)}
        className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-ink bg-paper text-sm font-medium text-ink disabled:border-line-strong disabled:text-muted ${className}`}
      >
        <SearchIcon size={16} strokeWidth={1.8} />
        {state === 'ready' ? '주소 검색으로 채우기' : '주소 검색 준비 중…'}
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-search-title"
          className="fixed inset-0 z-[70] flex flex-col bg-cream pt-[env(safe-area-inset-top)]"
        >
          <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-1">
            <button
              ref={closeBtn}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="주소 검색 닫기"
              className="flex h-11 w-11 items-center justify-center text-ink"
            >
              <ChevronLeftIcon size={22} strokeWidth={1.8} />
            </button>
            <h2 id="address-search-title" className="text-base font-bold text-ink">주소 검색</h2>
          </div>
          <p className="shrink-0 break-keep px-5 py-2.5 text-xs leading-[1.6] text-muted">
            도로명이나 건물 이름, 동 이름으로 찾아 주세요. 고르면 시·도, 시·군·구, 동이 함께 채워져요.
          </p>
          <div ref={frame} className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]" />
        </div>,
        document.body,
      )}
    </>
  );
}
