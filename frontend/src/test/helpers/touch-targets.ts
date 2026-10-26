/**
 * 누를 수 있는 것은 44px 이상이어야 한다 (디자인 기준 1번).
 *
 * jsdom은 화면을 그리지 않아 높이를 잴 수 없다(getBoundingClientRect가 모두 0이다).
 * 그래서 **클래스에 적힌 크기**로 본다 — 높이 클래스(h-11·min-h-[44px]…)나
 * 세로 패딩(py-3 이상)이 있으면 통과다. 실제 픽셀을 재는 것은 아니지만,
 * "크기를 적지 않은 작은 링크"를 잡는 데는 이것으로 충분하다.
 *
 * 카드 전체를 감싼 링크처럼 내용이 알아서 커지는 것은 data-tap="block"으로 표시한다.
 */

/** 본문 한 줄의 높이로 본다 (13~15px 글씨 기준) */
const LINE_HEIGHT = 20;
const MIN = 44;

/** Tailwind 간격 한 칸 = 4px */
const spacing = (token: string): number | null => {
  const px = token.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (px) return Number(px[1]);
  const step = token.match(/^(\d+(?:\.5)?)$/);
  return step ? Number(step[1]) * 4 : null;
};

/** 클래스에서 읽어 낸 높이. 모르면 null */
export function estimateHeight(className: string): number | null {
  const classes = className.split(/\s+/).filter(Boolean);
  let height: number | null = null;
  let paddingY = 0;

  for (const raw of classes) {
    // sm:·hover: 같은 조건부는 가장 작은 화면 기준이 아니라서 보지 않는다
    if (raw.includes(':')) continue;

    const h = raw.match(/^(?:min-)?h-(.+)$/);
    if (h) {
      const value = spacing(h[1]);
      if (value !== null) height = Math.max(height ?? 0, value);
      continue;
    }
    const py = raw.match(/^py-(.+)$/);
    if (py) {
      const value = spacing(py[1]);
      if (value !== null) paddingY = Math.max(paddingY, value);
      continue;
    }
    const p = raw.match(/^p-(.+)$/);
    if (p) {
      const value = spacing(p[1]);
      if (value !== null) paddingY = Math.max(paddingY, value);
    }
  }

  const fromPadding = paddingY > 0 ? LINE_HEIGHT + paddingY * 2 : null;
  if (height === null && fromPadding === null) return null;
  return Math.max(height ?? 0, fromPadding ?? 0);
}

/** 44px보다 작아 보이는 것들을 찾아 "글:높이" 모양으로 돌려준다 */
export function smallTouchTargets(root: HTMLElement): string[] {
  const targets = Array.from(root.querySelectorAll('a,button,summary,[role="menuitem"]'));
  const bad: string[] = [];

  for (const el of targets) {
    // 내용이 알아서 커지는 것(카드 전체 링크 등)은 표시해 두고 넘어간다
    if (el.closest('[data-tap="block"]')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (el.className.includes('sr-only')) continue;

    const height = estimateHeight(el.className);
    if (height === null || height < MIN) {
      const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20)
        || el.getAttribute('aria-label') || el.tagName.toLowerCase();
      bad.push(`${label}:${height ?? '크기 없음'}`);
    }
  }
  return bad;
}
