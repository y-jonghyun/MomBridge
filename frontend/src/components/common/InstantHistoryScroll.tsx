'use client';
import { useEffect } from 'react';

/**
 * 뒤로·앞으로 갈 때만 스크롤을 '바로' 되돌린다.
 *
 * html에 scroll-behavior: smooth가 있어(globals.css) 브라우저가 이전 화면의 스크롤 위치를 되돌릴 때도
 * 0에서부터 0.5초쯤 미끄러져 내려갔다. 앱처럼 보던 자리로 바로 돌아오도록, 기록 이동(popstate) 직후
 * 잠깐만 auto로 바꿨다가 되돌린다. 그 밖의 부드러운 스크롤(같은 화면 안 이동)은 그대로다.
 * 미끄러지는 동안 목록이 바뀌면 끝 위치가 어긋나는 문제(미션 목록, 2026-11-13 측정 26px)도 이것으로 없앤다.
 */
export const HISTORY_SCROLL_SETTLE_MS = 700;

export default function InstantHistoryScroll() {
  useEffect(() => {
    let timer: number | undefined;
    const onPop = () => {
      const html = document.documentElement;
      html.style.scrollBehavior = 'auto';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { html.style.scrollBehavior = ''; }, HISTORY_SCROLL_SETTLE_MS);
    };
    // Next의 처리보다 먼저 바꿔 두려고 capture 단계에서 듣는다
    window.addEventListener('popstate', onPop, true);
    return () => {
      window.removeEventListener('popstate', onPop, true);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
