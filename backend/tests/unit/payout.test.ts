import { isBusinessDay, nextPayoutDate, payoutDueDate, payoutDueLabel } from '../../src/lib/payout';

/** 약관 제8조: 매월 말일까지 승인된 건을 다음 달 10일에 지급, 휴일이면 다음 영업일 */
describe('보상 지급일', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('후기 마감이 속한 달의 다음 달 10일이다', () => {
    // 2026-11-10은 화요일 (평일)
    expect(iso(payoutDueDate(at(2026, 10, 1)))).toBe('2026-11-10');
    expect(iso(payoutDueDate(at(2026, 10, 31)))).toBe('2026-11-10');
    // 달 안의 어느 날이든 같은 지급일로 모인다
    expect(iso(payoutDueDate(at(2026, 10, 15)))).toBe('2026-11-10');
  });

  it('연말에는 해가 넘어간다', () => {
    // 2027-01-10은 일요일 → 월요일로 미룬다
    expect(iso(payoutDueDate(at(2026, 12, 20)))).toBe('2027-01-11');
  });

  it('10일이 주말이면 다음 영업일로 미룬다', () => {
    // 2026-10-10 토 → 월 10/12
    expect(iso(payoutDueDate(at(2026, 9, 30)))).toBe('2026-10-12');
    // 2027-04-10 토 → 월 4/12
    expect(iso(payoutDueDate(at(2027, 3, 5)))).toBe('2027-04-12');
    // 2026-05-10 일 → 월 5/11
    expect(iso(payoutDueDate(at(2026, 4, 20)))).toBe('2026-05-11');
  });

  it('10일이 대체공휴일이면 그다음 영업일로 미룬다', () => {
    // 한글날(10/9)이 일요일인 2027년 → 대체공휴일 10/11(월) → 지급은 10/12(화)
    expect(isBusinessDay(at(2027, 10, 11))).toBe(false);
    expect(iso(payoutDueDate(at(2027, 9, 15)))).toBe('2027-10-12');
  });

  it('공휴일 판정', () => {
    expect(isBusinessDay(at(2026, 1, 1))).toBe(false);   // 신정
    expect(isBusinessDay(at(2026, 12, 25))).toBe(false); // 성탄절(금)
    expect(isBusinessDay(at(2026, 11, 10))).toBe(true);
    expect(isBusinessDay(at(2026, 11, 8))).toBe(false);  // 일요일
  });

  it('오늘 기준 다음 정산일 — 지급일이 지나면 다음 달로 넘어간다', () => {
    // 2026-11-10(화)이 지급일 → 그 전날까지는 11월 10일
    expect(iso(nextPayoutDate(at(2026, 11, 1)))).toBe('2026-11-10');
    expect(iso(nextPayoutDate(at(2026, 11, 10)))).toBe('2026-11-10');
    // 지나면 12월 10일(목)
    expect(iso(nextPayoutDate(at(2026, 11, 11)))).toBe('2026-12-10');
    // 10월은 10일이 토요일이라 12일(월)까지가 이번 달 지급일
    expect(iso(nextPayoutDate(at(2026, 10, 11)))).toBe('2026-10-12');
    expect(iso(nextPayoutDate(at(2026, 10, 13)))).toBe('2026-11-10');
  });

  it('문구는 "n월 n일"', () => {
    expect(payoutDueLabel(at(2026, 10, 15))).toBe('11월 10일');
    expect(payoutDueLabel(at(2026, 9, 30))).toBe('10월 12일');
  });
});
