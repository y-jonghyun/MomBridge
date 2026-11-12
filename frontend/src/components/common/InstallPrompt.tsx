'use client';
import { useEffect, useRef, useState } from 'react';
import { ABOVE_BOTTOM_BAR, INSTALL_BANNER_VAR, useReportHeight } from '@/lib/bottom-chrome';

/** 닫으면 이 기기에서는 다시 띄우지 않는다 */
const DISMISS_KEY = 'mb:install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone·iPad의 Safari — 설치 이벤트가 없어 직접 안내해야 한다 (iPadOS는 Mac처럼 보이므로 터치 지원으로 가린다) */
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Instagram|FBAN/.test(ua);
}

function dismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 홈 화면 설치 안내. 하단 고정 막대(탭 막대·신청 버튼) 바로 위에 작은 카드로 띄운다.
 * 떠 있는 동안에는 자기 높이만큼 페이지 아래 여백을 늘려(globals.css의 body), 맨 아래 내용도 가리지 않는다.
 * - 안드로이드·데스크톱 크롬: beforeinstallprompt를 잡아 두었다가 "설치" 버튼으로 띄운다
 * - iOS Safari: "공유 → 홈 화면에 추가" 안내만 보여 준다
 */
export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissed()) return;
    if (isIosSafari()) {
      setIos(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!event && !ios) return null;
  return <InstallBanner ios={ios} event={event} onClose={() => { setEvent(null); setIos(false); }} onDismissEvent={() => setEvent(null)} />;
}

function InstallBanner({ ios, event, onClose, onDismissEvent }: {
  ios: boolean;
  event: BeforeInstallPromptEvent | null;
  onClose: () => void;
  onDismissEvent: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 배너 높이 + 아래 막대와의 간격 8px
  useReportHeight(ref, INSTALL_BANNER_VAR, 8);

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // 저장소를 못 쓰면 이번 화면에서만 닫는다
    }
    onClose();
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // 설치를 고르면 다시 띄울 일이 없고, 거절해도 같은 이벤트는 다시 쓸 수 없다
    if (outcome === 'accepted') close();
    else onDismissEvent();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="맘브릿지 앱 설치"
      style={{ bottom: ABOVE_BOTTOM_BAR }}
      className="fixed inset-x-0 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-card border border-line bg-paper py-2 pl-4 pr-2 shadow-lg"
    >
      <img src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[10px]" />
      <p className="flex-1 break-keep text-[13px] leading-snug text-ink-2">
        {ios ? (
          <>
            <b className="font-medium text-ink">홈 화면에 추가</b>하면 앱처럼 쓸 수 있어요. 아래 공유 버튼 → ‘홈 화면에 추가’
          </>
        ) : (
          <>
            <b className="font-medium text-ink">맘브릿지 앱</b>을 홈 화면에 설치해 보세요
          </>
        )}
      </p>
      {!ios && (
        <button
          type="button"
          onClick={install}
          className="h-11 shrink-0 rounded-control bg-clay px-4 text-sm font-bold text-paper"
        >
          설치
        </button>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="설치 안내 닫기"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-lg text-muted"
      >
        ×
      </button>
    </div>
  );
}
