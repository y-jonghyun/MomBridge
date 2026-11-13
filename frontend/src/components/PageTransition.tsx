'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  PAGE_TRANSITIONS_ENABLED, TRANSITION_EASING, TRANSITION_MS, VEIL_KEYFRAMES, prefersReducedMotion, slideKeyframes,
  type NavKind,
} from '@/lib/page-transitions';

/**
 * 주소(경로)가 바뀌면 새 화면이 살짝 밀려 들어온다. 꺼져 있으면 감싸는 상자조차 만들지 않는다.
 *
 * - 화면을 다시 만들지 않는다(key를 바꾸지 않는다) — 입력 중인 값·스크롤 복원을 건드리지 않으려고.
 * - 같은 경로에서 ?tab= 같은 검색어만 바뀌면 움직이지 않는다.
 * - 뒤로 가기는 왼쪽에서, 링크는 오른쪽에서, 하단 탭은 제자리에서 흐려졌다 나타난다.
 * - 하단 탭 막대·고정 버튼은 움직이지도 흐려지지도 않는다 (가림막이 그 아래에 있다).
 * - 움직임 줄이기를 켠 사용자에게는 움직이지 않는다 (매번 확인한다 — 도중에 설정을 바꿔도 따른다).
 */
export default function PageTransition({ children, enabled = PAGE_TRANSITIONS_ENABLED }: {
  children: React.ReactNode;
  /** 테스트용. 기본은 환경 변수 값 */
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const kind = useRef<NavKind>('forward');
  const last = useRef(pathname);

  // 무엇을 눌러 이동하는지 미리 적어 둔다 (경로가 바뀐 뒤에는 알 수 없다)
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => { kind.current = 'back'; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      kind.current = a.closest('nav[aria-label="하단 메뉴"]') ? 'tab' : 'forward';
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
    };
  }, [enabled]);

  // 그리기 전에 시작해야 새 화면이 제자리에 한 번 보였다가 움직이는 깜빡임이 없다
  useLayoutEffect(() => {
    if (!enabled || last.current === pathname) return;
    last.current = pathname;
    const how = kind.current;
    kind.current = 'forward';
    const el = box.current;
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    const timing = { duration: TRANSITION_MS, easing: TRANSITION_EASING };
    const slide = slideKeyframes(how);
    if (slide) el.animate(slide, timing);
    veil.current?.animate(VEIL_KEYFRAMES, timing);
  }, [pathname, enabled]);

  if (!enabled) return <>{children}</>;
  return (
    <>
      <div ref={box} data-page-transition="" className="relative">{children}</div>
      {/* 크림색 가림막 — 평소에는 투명하고 누를 수 없다. 앱 막대(z-20) 위, 하단 막대(z-30) 아래 */}
      <div ref={veil} aria-hidden="true" data-page-transition-veil="" className="pointer-events-none fixed inset-0 z-[25] bg-cream opacity-0" />
    </>
  );
}
