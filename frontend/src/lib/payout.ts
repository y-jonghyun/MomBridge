'use client';
import api from '@/lib/api';

/**
 * 보상 지급일 — 약관 제8조.
 * "매월 말일까지 승인된 건을 다음 달 10일에 지급한다. 지급일이 휴일이면 다음 영업일에 지급한다."
 *
 * 휴일 보정까지 들어가는 계산은 **서버에만 둔다** (backend/src/lib/payout.ts, 단위 테스트로 고정).
 * 화면은 서버가 준 날짜를 받아 모양만 만든다 —
 * 미션 상세는 `mission.payoutDueDate`, 홈·내 활동 카드는 아래 fetchNextPayoutDate.
 */

/** 지급일 아래에 함께 보여 주는 단서 — 승인이 늦어지면 약관상 지급도 다음 달로 넘어간다 */
export const PAYOUT_DELAY_HINT = '검수가 늦어지면 다음 달로 미뤄질 수 있어요';

/** "11월 10일" */
export const payoutLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

/** 오늘 기준 다음 정산일. 못 받아오면 null (카드에서 날짜 줄을 비운다) */
export async function fetchNextPayoutDate(): Promise<Date | null> {
  try {
    const { data } = await api.get('/participant/payout-schedule');
    return new Date(data.data.nextPayoutDate);
  } catch {
    return null;
  }
}
