// 테스트에서 시각을 고정할 수 있도록 현재 시각은 항상 여기서 얻는다
let override: (() => Date) | null = null;

export const clock = {
  now: (): Date => (override ? override() : new Date()),
  set(fn: (() => Date) | null) { override = fn; },
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜를 UTC 자정 Date로 (Postgres DATE 컬럼 값) */
export function kstDayKey(at: Date = clock.now()): Date {
  const kst = new Date(at.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * 86400000);
}

export function formatDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → dayKey. 형식이 틀리면 null */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
