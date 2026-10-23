'use client';
import { useState } from 'react';
import { HeartIcon } from './icons';

/** 미션 상세 하단 고정: 찜(52×52) + 신청 버튼(clay, 높이 52) */
export function StickyCTA({
  label, onPress, disabled = false, saved = false, onToggleSave,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-line bg-paper px-5 py-3">
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
    </div>
  );
}

export interface ScheduleStep {
  label: string;
  /** 비어 있으면 그 단계는 보여주지 않는다 (데이터가 아직 없는 단계) */
  when?: string | null;
  /** 지금 진행 중인 단계 */
  current?: boolean;
  /** 오른쪽 끝에 덧붙일 강조 (예: D-3) */
  note?: string | null;
}

/** 신청 → 선정 발표 → 방문·후기 → 보상 지급. 현재 단계 점은 clay 채움 */
export function ScheduleTimeline({ steps }: { steps: ScheduleStep[] }) {
  const shown = steps.filter(s => s.when);
  if (shown.length === 0) return null;
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {shown.map(s => (
        <li key={s.label} className="grid min-h-10 grid-cols-[20px_1fr_auto] items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 justify-self-center rounded-full ${
              s.current ? 'bg-clay' : 'border-[1.5px] border-[#B8AC9B]'
            }`}
          />
          <span className={`text-sm ${s.current ? 'font-medium' : ''}`}>{s.label}</span>
          <span className="text-[13px] text-ink-2">
            {s.when}
            {s.note && <b className="ml-1 font-medium text-clay">{s.note}</b>}
          </span>
        </li>
      ))}
    </ol>
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
