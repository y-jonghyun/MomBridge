import KoreanLunarCalendar from 'korean-lunar-calendar';

/**
 * 보상 지급일 — 약관 제8조.
 * "매월 말일까지 승인된 건을 다음 달 10일에 지급한다. 지급일이 휴일이면 다음 영업일에 지급한다."
 *
 * 미션 상세의 '보상 지급' 단계는 후기 마감일이 속한 달을 기준으로 잡는다
 * (그 달 안에 승인이 끝난다는 전제) → 다음 달 10일, 휴일이면 다음 영업일.
 *
 * 화면은 이 계산을 하지 않는다 — 서버가 준 날짜를 받아 모양만 만든다.
 */

/** 지급일로 잡는 날짜 (매월 10일) */
export const PAYOUT_DAY = 10;

/** 날짜가 고정된 양력 공휴일 */
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

/**
 * 주말과 겹치면 대체공휴일이 생기는 날.
 * 신정과 현충일은 대체공휴일이 없다 (공휴일에 관한 법률 시행령 제3조).
 * 부처님오신날은 음력이라 아래에서 따로 넣는다.
 */
const WEEKEND_SUBSTITUTED = new Set(['3-1', '5-5', '8-15', '10-3', '10-9', '12-25']);

/**
 * 임시공휴일처럼 법으로 그때그때 정해지는 날을 손으로 넣는 자리 ('YYYY-MM-DD').
 * 설날·추석·부처님오신날은 음력에서 자동으로 계산하므로 여기 넣지 않아도 된다.
 */
export const EXTRA_HOLIDAYS: string[] = [];

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** 음력 날짜를 양력으로 (한국 음력 기준) */
function lunarToSolar(year: number, month: number, day: number): Date {
  const calendar = new KoreanLunarCalendar();
  // 윤달은 쓰지 않는다 — 설날·추석·부처님오신날은 모두 평달이다
  if (!calendar.setLunarDate(year, month, day, false)) {
    throw new Error(`음력 ${year}-${month}-${day}를 양력으로 바꿀 수 없습니다`);
  }
  const s = calendar.getSolarCalendar();
  return new Date(s.year, s.month - 1, s.day);
}

/** 그 해의 음력 공휴일 — 설날 연휴 3일, 추석 연휴 3일, 부처님오신날 */
function lunarHolidaysOf(year: number): { seollal: Date[]; chuseok: Date[]; buddha: Date } {
  const newYear = lunarToSolar(year, 1, 1);
  const harvest = lunarToSolar(year, 8, 15);
  return {
    seollal: [addDays(newYear, -1), newYear, addDays(newYear, 1)],
    chuseok: [addDays(harvest, -1), harvest, addDays(harvest, 1)],
    buddha: lunarToSolar(year, 4, 8),
  };
}

/** 연휴가 끝난 다음의 첫 번째 비공휴일 (토요일과 다른 공휴일은 건너뛴다) */
function firstFreeWeekdayAfter(last: Date, taken: Set<string>): Date {
  let d = addDays(last, 1);
  while (isWeekend(d) || taken.has(key(d))) d = addDays(d, 1);
  return d;
}

/**
 * 그 해의 공휴일 집합 ('Y-M-D'). 대체공휴일까지 넣는다.
 *
 * 대체공휴일 규칙(시행령 제3조)을 다음과 같이 본다.
 * - 삼일절·어린이날·부처님오신날·광복절·개천절·한글날·성탄절: 토·일과 겹치면 하루
 * - 설날·추석 연휴: 사흘 중 하루라도 일요일이거나 다른 공휴일과 겹치면 하루
 * - 신정·현충일: 대체 없음
 */
function holidaysOf(year: number): Set<string> {
  const set = new Set<string>();
  const fixed: Date[] = [];
  for (const [m, day] of FIXED_HOLIDAYS) {
    const d = new Date(year, m - 1, day);
    fixed.push(d);
    set.add(key(d));
  }

  const { seollal, chuseok, buddha } = lunarHolidaysOf(year);
  for (const d of [...seollal, ...chuseok, buddha]) set.add(key(d));

  // 1) 주말과 겹치는 공휴일
  const weekendTargets = [
    ...fixed.filter(d => WEEKEND_SUBSTITUTED.has(`${d.getMonth() + 1}-${d.getDate()}`)),
    buddha,
  ];
  for (const d of weekendTargets) {
    if (!isWeekend(d)) continue;
    set.add(key(firstFreeWeekdayAfter(d, set)));
  }

  // 2) 설날·추석 연휴 — 일요일이나 다른 공휴일과 겹치면 하루 더
  const fixedKeys = new Set(fixed.map(key));
  for (const run of [seollal, chuseok]) {
    const overlaps = run.some(d => d.getDay() === 0 || fixedKeys.has(key(d)));
    if (overlaps) set.add(key(firstFreeWeekdayAfter(run[run.length - 1], set)));
  }

  for (const iso of EXTRA_HOLIDAYS) {
    const [y, m, day] = iso.split('-').map(Number);
    if (y === year) set.add(`${y}-${m}-${day}`);
  }
  return set;
}

/** 공휴일 목록을 'YYYY-MM-DD'로 정렬해 돌려준다 (확인·테스트용) */
export function holidayList(year: number): string[] {
  return [...holidaysOf(year)]
    .map(k => k.split('-').map(Number))
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
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
