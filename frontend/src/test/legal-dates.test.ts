import { describe, expect, it } from 'vitest';
import { PRIVACY_CHANGES, PRIVACY_EFFECTIVE_DATE, TERMS_EFFECTIVE_DATE } from '@/lib/legal';

/**
 * 방침을 고치면 시행일과 변경 이력이 함께 움직여야 한다.
 * (재동의가 필요한 변경인지는 legal.ts 주석의 기준을 따른다)
 */
describe('약관·방침 시행일', () => {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  it('날짜 형식을 지킨다', () => {
    expect(PRIVACY_EFFECTIVE_DATE).toMatch(DATE);
    expect(TERMS_EFFECTIVE_DATE).toMatch(DATE);
  });

  it('방침 시행일은 가장 최근 변경 이력과 같다', () => {
    expect(PRIVACY_CHANGES.length).toBeGreaterThan(0);
    expect(PRIVACY_CHANGES[0].date).toBe(PRIVACY_EFFECTIVE_DATE);
  });

  it('변경 이력은 새 것이 위에 오고 설명이 비어 있지 않다', () => {
    const dates = PRIVACY_CHANGES.map(c => c.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const change of PRIVACY_CHANGES) {
      expect(change.date).toMatch(DATE);
      expect(change.summary.trim().length).toBeGreaterThan(0);
    }
  });
});
