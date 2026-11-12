'use client';
import { type RefObject, useEffect } from 'react';

/**
 * 화면 아래에 붙어 있는 것들(하단 탭 막대, 하단 고정 신청 버튼, 설치 안내 배너)이
 * 서로를 가리지 않도록, 각자의 높이를 :root의 CSS 변수로 알린다.
 *
 * - --mb-bottom-bar     : 하단 고정 막대의 높이(안전 영역 포함). 배너·안내 문구는 이 위에 뜬다
 * - --mb-install-banner : 설치 배너가 차지하는 높이. body 아래 여백으로 써서, 맨 아래 내용도 배너 위로 올라오게 한다
 *
 * 한 화면에 하단 고정 막대는 하나만 둔다(탭 막대가 있는 화면에는 하단 고정 버튼이 없다).
 * 숨겨진 막대(예: 데스크톱에서 숨기는 탭 막대)는 높이 0으로 알린다.
 */
export const BOTTOM_BAR_VAR = '--mb-bottom-bar';
export const INSTALL_BANNER_VAR = '--mb-install-banner';

/** 하단 막대 위에 띄우는 것의 bottom 값 — 막대가 없으면 홈 인디케이터(안전 영역) 위 */
export const ABOVE_BOTTOM_BAR = `calc(max(var(${BOTTOM_BAR_VAR}, 0px), env(safe-area-inset-bottom)) + 8px)`;

/**
 * ref가 가리키는 요소의 높이를 CSS 변수로 알린다. 요소가 사라지면 변수를 지운다.
 * @param extra 높이에 더할 값(px) — 배너와 아래 막대 사이 간격처럼 함께 비워 둘 공간
 */
export function useReportHeight(ref: RefObject<HTMLElement | null>, cssVar: string, extra = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const report = () => {
      const h = el.getBoundingClientRect().height;
      root.style.setProperty(cssVar, `${h > 0 ? Math.ceil(h + extra) : 0}px`);
    };
    report();
    // 글자 크기·화면 회전으로 높이가 바뀌면 다시 알린다 (ResizeObserver가 없는 환경은 처음 한 번만)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(report);
    ro?.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', report);
      root.style.removeProperty(cssVar);
    };
  }, [ref, cssVar, extra]);
}
