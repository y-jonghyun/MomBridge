/**
 * 화면 전환 움직임 (app-feel PR 9) — 기본은 꺼짐, 환경 변수 하나로 켜고 끈다.
 *
 *   NEXT_PUBLIC_PAGE_TRANSITIONS=on   → 켬
 *   NEXT_PUBLIC_PAGE_TRANSITIONS=off  → 끔 (문제가 생기면 이 값으로 다시 배포하면 바로 꺼진다)
 *   비워 두면 → Vercel 프리뷰 빌드(VERCEL_ENV=preview)에서만 켜고, 운영·로컬은 끔 (next.config.ts에서 정한다)
 *
 * 빌드할 때 값이 박히므로 바꾸면 다시 배포해야 한다.
 * 움직임 줄이기(prefers-reduced-motion: reduce)를 켠 사용자에게는 이 값과 상관없이 항상 꺼진다.
 */
export const PAGE_TRANSITIONS_ENABLED = process.env.NEXT_PUBLIC_PAGE_TRANSITIONS === 'on';

/** 어떻게 들어왔는지 — 목록에서 상세로(forward) · 뒤로 가기(back) · 하단 탭(tab) */
export type NavKind = 'forward' | 'back' | 'tab';

export const TRANSITION_MS = 220;
export const TRANSITION_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * 들어오는 화면만 움직인다 (나가는 화면은 그대로 바뀐다). 움직임은 둘로 나눈다.
 *
 * 1) 화면 상자를 옆으로 조금 민다 (slideKeyframes) — transform 대신 left를 쓴다.
 *    transform은 안쪽의 position:fixed(하단 탭·고정 버튼·창)를 움직이는 상자에 묶어 버려 전환하는 동안 탭 막대가 튄다.
 * 2) 크림색 가림막을 걷어 낸다 (VEIL_KEYFRAMES) — 화면 상자 자체의 opacity를 바꾸면 그 안의 하단 탭 막대까지 흐려지므로,
 *    가림막을 하단 막대(z-30)보다 아래(z-25)에 두어 탭 막대·고정 버튼은 처음부터 또렷하게 둔다.
 */
export function slideKeyframes(kind: NavKind): Keyframe[] | null {
  if (kind === 'tab') return null;
  const from = kind === 'back' ? '-24px' : '24px';
  return [{ left: from }, { left: '0px' }];
}

export const VEIL_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
