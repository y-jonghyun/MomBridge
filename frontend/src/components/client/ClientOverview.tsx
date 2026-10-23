'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

/** 기준: docs/design/mombridge-design/cream-editorial-v1.md 3번 '고객사 홈' + Client.html */

const STAGES = ['모집', '선정', '체험·후기', '완료'];

/** 미션 상태를 4단계 중 어디인지로 바꾼다 */
export function clientMissionStage(m: { status?: string }) {
  switch (m.status) {
    case 'OPEN': return 0;
    case 'IN_PROGRESS': return 1;
    case 'REVIEWING': return 2;
    case 'CLOSED': return 3;
    default: return 0;
  }
}

export function MissionProgress({ current }: { current: number }) {
  return (
    <ol aria-label="진행 단계" className="m-0 mt-4 grid list-none grid-cols-4 gap-1 p-0">
      {STAGES.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className={`text-center text-[11px] ${now ? 'font-bold text-clay' : done ? 'text-ink' : 'text-muted'}`}>
            <span className={`mb-1.5 block h-1 rounded ${done ? 'bg-clay' : now ? 'bg-[#E3C2AC]' : 'bg-line'}`} />
            {label}
          </li>
        );
      })}
    </ol>
  );
}

interface Daily { day: string; clicks: number; uniqueVisitors: number }

/**
 * 가게 전체 성과 카드.
 * 계정 단위 집계 API가 아직 없어, 결제가 끝난 내 미션들의 리포트를 받아 합친다.
 * 요청이 많아지지 않도록 최근 미션 몇 건으로 제한한다.
 */
const MAX_REPORTS = 8;

export function ClientPerformanceCard({
  missions, onOpenReport,
}: {
  missions: any[];
  onOpenReport: (mission: any) => void;
}) {
  const [totals, setTotals] = useState<{ clicks: number; uniqueVisitors: number; reviews: number } | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);

  const paid = missions.filter(m => m.paymentStatus !== 'PENDING').slice(0, MAX_REPORTS);
  const key = paid.map(m => m.id).join(',');

  useEffect(() => {
    if (paid.length === 0) { setTotals(null); setDaily([]); return; }
    let alive = true;
    Promise.all(paid.map(m =>
      api.get(`/client/missions/${m.id}/report`).then(r => r.data.data).catch(() => null),
    )).then(reports => {
      if (!alive) return;
      const ok = reports.filter(Boolean);
      const sum = ok.reduce((acc, r: any) => ({
        clicks: acc.clicks + (r.totals?.clicks ?? 0),
        uniqueVisitors: acc.uniqueVisitors + (r.totals?.uniqueVisitors ?? 0),
        reviews: acc.reviews + (r.totals?.reviews ?? 0),
      }), { clicks: 0, uniqueVisitors: 0, reviews: 0 });

      // 날짜별로 합쳐 최근 7일만 쓴다
      const byDay = new Map<string, Daily>();
      for (const r of ok) {
        for (const d of ((r as any).daily ?? []) as Daily[]) {
          const prev = byDay.get(d.day);
          byDay.set(d.day, prev
            ? { day: d.day, clicks: prev.clicks + d.clicks, uniqueVisitors: prev.uniqueVisitors + d.uniqueVisitors }
            : { ...d });
        }
      }
      setTotals(sum);
      setDaily(Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)).slice(-7));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (paid.length === 0) return null;

  const max = Math.max(1, ...daily.map(d => d.clicks));

  return (
    <section className="mt-2.5 rounded-box border border-line bg-paper px-5 py-[22px]">
      <p className="text-[13px] text-muted">이번 달 후기로 들어온 방문</p>
      <p className="mt-1 font-serif text-[34px] font-bold tracking-[-0.02em]">
        {totals ? totals.clicks.toLocaleString() : '–'}
        <span className="ml-1 font-sans text-[15px] font-medium">회</span>
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        고유 방문자 {totals ? totals.uniqueVisitors.toLocaleString() : '–'}명 · 후기 {totals ? totals.reviews : '–'}건
      </p>

      {daily.length > 0 && (
        <>
          <div className="mt-4 flex h-16 items-end gap-1.5" aria-hidden="true">
            {daily.map((d, i) => (
              <span
                key={d.day}
                style={{ height: `${Math.max(6, Math.round((d.clicks / max) * 100))}%` }}
                className={`flex-1 rounded-t ${i === daily.length - 1 ? 'bg-clay' : 'bg-line'}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>최근 {daily.length}일</span><span>오늘</span>
          </div>
        </>
      )}

      <button
        onClick={() => onOpenReport(paid[0])}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-control border border-ink text-sm font-medium text-ink"
      >
        성과 리포트 자세히 보기
      </button>
    </section>
  );
}
