/**
 * 보상 지급일 — 약관 제8조: 매월 말일에 마감하고 다음 달 10일에 지급한다.
 * 홈의 '내 다음 정산일'과 미션 상세의 '보상 지급' 단계가 같은 규칙을 쓴다.
 */
export function nextPayoutLabel(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), 10);
  if (from.getDate() >= 10) d.setMonth(d.getMonth() + 1);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
