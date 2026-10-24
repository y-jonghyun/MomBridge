'use client';
import { useState } from 'react';

/**
 * 관리자 화면 공용 조각.
 * 기준: docs/design/mombridge-design/cream-editorial-v1.md
 *
 * 버튼 색 규칙
 * - 주 동작(승인·지급 완료·저장): 진한 ink 또는 clay 채움
 * - 보조 동작(사진·수정 등): 테두리만
 * - 위험한 동작(반려·비활성화): 테두리만 있는 빨간 계열 + 확인 창
 */

const BASE = 'inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-control px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40';

/** 주 동작 */
export function PrimaryButton({
  children, onClick, disabled, title, tone = 'ink', type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  tone?: 'ink' | 'clay';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`${BASE} ${tone === 'clay' ? 'bg-clay text-paper' : 'bg-ink text-paper'}`}
    >
      {children}
    </button>
  );
}

/** 보조 동작 — 테두리만 */
export function QuietButton({
  children, onClick, disabled, title,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`${BASE} border border-line bg-paper text-ink-2`}>
      {children}
    </button>
  );
}

/**
 * 위험한 동작 — 테두리만 있는 빨간 계열. 누르면 확인 창을 거친다.
 * 확인 창은 브라우저 confirm 대신 버튼 자리에서 바로 묻는다 (화면이 멈추지 않게).
 */
export function DangerButton({
  children, confirmLabel = '정말 할까요?', onConfirm, disabled, title,
}: {
  children: React.ReactNode;
  /** 확인 단계에서 보여 줄 문구 */
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <span className="text-xs text-clay-dark">{confirmLabel}</span>
        <button type="button" onClick={() => { setAsking(false); onConfirm(); }}
          className={`${BASE} bg-clay-dark px-2.5 text-paper`}>예</button>
        <button type="button" onClick={() => setAsking(false)}
          className={`${BASE} border border-line bg-paper px-2.5 text-ink-2`}>아니요</button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setAsking(true)} disabled={disabled} title={title}
      className={`${BASE} border border-clay-dark bg-paper text-clay-dark`}>
      {children}
    </button>
  );
}

/**
 * 표 상자. 표가 좁으면 **상자 안에서만** 가로로 스크롤한다 (화면 전체가 밀리지 않게).
 * 1024px 미만에서는 표를 숨기고 카드 목록을 보여 주므로 lg부터 나타난다.
 */
export function TableBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden overflow-hidden rounded-box bg-paper lg:block">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/** 표 머리. 제목은 줄바꿈하지 않는다 */
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="border-b border-line bg-cream">
      <tr>
        {columns.map(h => (
          <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium text-ink-2">{h}</th>
        ))}
      </tr>
    </thead>
  );
}

/** 1024px 미만에서 쓰는 카드 목록 자리 */
export function CardList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 lg:hidden">{children}</div>;
}

export function CardRow({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border border-line bg-paper p-4">{children}</div>;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="rounded-box bg-paper py-12 text-center text-muted">{children}</div>;
}

/** "10.23" — 마우스를 올리면 전체 날짜 */
export function ShortDate({ value }: { value?: string | Date | null }) {
  if (!value) return <span className="text-muted">-</span>;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return <span className="text-muted">-</span>;
  const short = `${d.getMonth() + 1}.${d.getDate()}`;
  const full = d.toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return <time dateTime={d.toISOString()} title={full} className="whitespace-nowrap">{short}</time>;
}

/** 금액 — 줄바꿈하지 않는다 */
export const Won = ({ value, className = '' }: { value: unknown; className?: string }) => (
  <span className={`whitespace-nowrap ${className}`}>{Number(value ?? 0).toLocaleString()}원</span>
);

/** 상태 배지 — 줄바꿈하지 않는다 */
export function StatusBadge({ children, className = 'bg-cream text-ink-2' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
