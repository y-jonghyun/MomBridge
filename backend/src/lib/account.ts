/**
 * 계좌번호 가리기.
 * 목록에는 끝 네 자리만 내보내고, 전체는 '보기'를 눌렀을 때만 따로 받아 간다.
 */

/** "****3456" — 숫자가 넷보다 적으면 통째로 가린다 */
export function maskAccount(account?: string | null): string | null {
  if (!account) return null;
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length || 4);
  return `****${digits.slice(-4)}`;
}
