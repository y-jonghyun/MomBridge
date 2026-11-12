'use client';
import { useState } from 'react';
import { HeartIcon } from './icons';
import FixedBottomBar from './FixedBottomBar';

/** 미션 상세 하단 고정: 왼쪽 짧은 정보(예: 모집 마감 D-8) 또는 찜(52×52) + 신청 버튼(clay, 높이 52) */
export function StickyCTA({
  label, onPress, disabled = false, saved = false, onToggleSave, meta,
}: {
  label: string;
  /** 버튼 왼쪽에 두 줄로 보여 줄 정보 */
  meta?: { label: string; value: string } | null;
  onPress?: () => void;
  disabled?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <FixedBottomBar className="flex items-center gap-3">
      {meta && (
        <div className="shrink-0">
          <p className="text-xs text-muted">{meta.label}</p>
          <p className="text-[17px] font-bold text-ink">{meta.value}</p>
        </div>
      )}
      {onToggleSave && (
        <button
          type="button" onClick={onToggleSave}
          aria-label={saved ? '찜 해제' : '찜하기'} aria-pressed={saved}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-control-lg border border-line bg-paper text-ink"
        >
          <HeartIcon className={saved ? 'fill-clay text-clay' : undefined} />
        </button>
      )}
      <button
        type="button" onClick={onPress} disabled={disabled}
        className="h-[52px] flex-1 rounded-control-lg bg-clay text-base font-bold text-paper disabled:opacity-50"
      >
        {label}
      </button>
    </FixedBottomBar>
  );
}

/** 키워드 칩 + 전체 복사 + 대가 표시 안내 */
export function KeywordBox({
  main = [], sub = [], disclosure = "글 맨 위에 '체험단으로 제공받아 작성한 후기입니다'를 적어 주세요.",
}: {
  main?: string[];
  sub?: string[];
  disclosure?: string;
}) {
  const [copied, setCopied] = useState(false);
  const all = [...main, ...sub];
  if (all.length === 0) return null;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(all.join(', '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-photo border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium">제목에 꼭 넣을 키워드</p>
        <button
          type="button" onClick={copyAll}
          className="h-9 shrink-0 rounded-[10px] border border-line bg-cream px-3 text-xs text-ink-2"
        >
          {copied ? '복사됨' : '전체 복사'}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {main.map(k => (
          <span key={k} className="rounded-lg bg-clay-tint px-2.5 py-[5px] text-[13px] text-clay-dark">{k}</span>
        ))}
        {sub.map(k => (
          <span key={k} className="rounded-lg bg-cream px-2.5 py-[5px] text-[13px] text-ink-2">{k}</span>
        ))}
      </div>
      <p className="mt-2.5 text-xs leading-[1.6] text-muted">{disclosure}</p>
      <span aria-live="polite" className="sr-only">{copied ? '키워드를 복사했습니다' : ''}</span>
    </div>
  );
}
