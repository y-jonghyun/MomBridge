'use client';
import { QuietButton } from './ui';

/**
 * 정산 행의 입금 계좌.
 * 목록에는 끝 네 자리만 오고, '보기'를 누르면 서버에서 전체를 받아 온다.
 * 전체를 받아 간 사실은 서버가 AuditLog에 남긴다.
 */
export interface PayoutRow {
  id: string;
  bankName?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  hasAccount?: boolean;
  revealed?: boolean;
}

export default function PayoutAccount({ payout, onReveal }: {
  payout: PayoutRow;
  onReveal: (id: string) => void;
}) {
  if (!payout.hasAccount) {
    return <span className="whitespace-nowrap text-xs font-medium text-clay-dark">계좌 미등록</span>;
  }

  return (
    <div className="min-w-0">
      <p className="whitespace-nowrap text-sm text-ink">
        {payout.bankName} {payout.bankAccount}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="whitespace-nowrap text-xs text-muted">예금주 {payout.accountHolder}</span>
        {!payout.revealed && <QuietButton onClick={() => onReveal(payout.id)}>보기</QuietButton>}
      </div>
    </div>
  );
}
