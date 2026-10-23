/**
 * 보상 지급일 — 약관 제8조.
 * "매월 말일까지 승인된 건을 다음 달 10일에 지급한다. 지급일이 휴일이면 다음 영업일에 지급한다."
 *
 * 미션 상세의 '보상 지급' 단계는 후기 마감일이 속한 달을 기준으로 잡는다
 * (그 달 안에 승인이 끝난다는 전제) → 다음 달 10일, 휴일이면 다음 영업일.
 *
 * ⚠️ 프론트의 frontend/src/lib/payout.ts가 같은 규칙을 쓴다. 바꿀 때 둘 다 바꾼다.
 */

/** 지급일로 잡는 날짜 (매월 10일) */
export const PAYOUT_DAY = 10;

/**
 * 날짜가 고정된 공휴일 (양력).
 * 설날·추석·부처님오신날은 해마다 달라져서 여기에 넣지 않는다 —
 * 필요하면 EXTRA_HOLIDAYS에 'YYYY-MM-DD'로 더한다.
 */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],   // 신정
  [3, 1],   // 삼일절
  [5, 5],   // 어린이날
  [6, 6],   // 현충일
  [8, 15],  // 광복절
  [10, 3],  // 개천절
  [10, 9],  // 한글날
  [12, 25], // 성탄절
];

/** 대체공휴일이 생기는 날 (현충일·성탄절·신정은 대체공휴일이 없다) */
const SUBSTITUTED = new Set(['3-1', '5-5', '8-15', '10-3', '10-9']);

/**
 * 해마다 달라지는 공휴일을 손으로 채우는 자리 ('YYYY-MM-DD').
 * 설날·추석·부처님오신날이 10일 언저리에 걸리는 해에만 필요하다.
 */
export const EXTRA_HOLIDAYS: string[] = [];

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** 그 해의 공휴일 집합 ('Y-M-D'). 대체공휴일까지 넣는다 */
function holidaysOf(year: number): Set<string> {
  const set = new Set<string>();
  for (const [m, day] of FIXED_HOLIDAYS) set.add(`${year}-${m}-${day}`);

  // 주말에 걸린 공휴일은 다음 평일을 대체공휴일로 쉰다
  for (const [m, day] of FIXED_HOLIDAYS) {
    if (!SUBSTITUTED.has(`${m}-${day}`)) continue;
    const d = new Date(year, m - 1, day);
    if (!isWeekend(d)) continue;
    const sub = new Date(d);
    do { sub.setDate(sub.getDate() + 1); } while (isWeekend(sub) || set.has(key(sub)));
    set.add(key(sub));
  }

  for (const iso of EXTRA_HOLIDAYS) {
    const [y, m, day] = iso.split('-').map(Number);
    if (y === year) set.add(`${y}-${m}-${day}`);
  }
  return set;
}

export function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !holidaysOf(d.getFullYear()).has(key(d));
}

/**
 * 후기 마감일(또는 승인일)이 속한 달의 **다음 달 10일**.
 * 그날이 주말·공휴일이면 다음 영업일로 미룬다.
 */
export function payoutDueDate(from: Date): Date {
  const due = new Date(from.getFullYear(), from.getMonth() + 1, PAYOUT_DAY);
  while (!isBusinessDay(due)) due.setDate(due.getDate() + 1);
  return due;
}

/** "11월 10일" */
export const payoutDueLabel = (from: Date) => {
  const d = payoutDueDate(from);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 오늘 기준 다음 정산일.
 * 이번 달 지급일이 아직 지나지 않았으면 그날, 지났으면 다음 달 지급일.
 */
export function nextPayoutDate(now: Date = new Date()): Date {
  const thisMonth = payoutDueDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  return now <= thisMonth ? thisMonth : payoutDueDate(now);
}
