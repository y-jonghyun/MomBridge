'use client';
import { useState } from 'react';
import DailyChart from './DailyChart';

export interface CampaignReportData {
  notice: string;
  range: { from: string; to: string };
  mission: { title: string; campaignCode: string; mainKeyword: string | null; subKeywords: string[] };
  totals: { clicks: number; uniqueVisitors: number; reviews: number; avgClicksPerReview: number | null };
  devices: { mobile: number; pc: number; unknown: number };
  daily: { day: string; clicks: number; uniqueVisitors: number }[];
  ranking: {
    linkCode: string; participantName: string; postUrl: string | null;
    disclosure: string; clicks: number; uniqueVisitors: number;
  }[];
  topReferers: { domain: string; clicks: number }[];
  disclosure: Record<string, number>;
}

const DISCLOSURE_LABEL: Record<string, { label: string; cls: string }> = {
  AUTO_PASSED: { label: '✓ 자동 확인', cls: 'bg-sage-tint text-sage' },
  MANUAL_CONFIRMED: { label: '✓ 운영자 확인', cls: 'bg-sage-tint text-sage' },
  NEEDS_MANUAL_REVIEW: { label: '! 확인 중', cls: 'bg-clay-tint text-clay-dark' },
  NOT_CHECKED: { label: '- 대상 아님', cls: 'bg-cream text-muted' },
  NOT_SUBMITTED: { label: '- 미제출', cls: 'bg-cream text-muted' },
};

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '-');

export default function CampaignReport({ report }: { report: CampaignReportData }) {
  const [showTable, setShowTable] = useState(false);
  const deviceTotal = report.devices.mobile + report.devices.pc + report.devices.unknown;
  const compliant = (report.disclosure.AUTO_PASSED ?? 0) + (report.disclosure.MANUAL_CONFIRMED ?? 0);
  const submitted = compliant + (report.disclosure.NEEDS_MANUAL_REVIEW ?? 0) + (report.disclosure.NOT_CHECKED ?? 0);

  return (
    <div className="space-y-4">
      <div className="bg-cream border border-line text-ink text-sm rounded-card px-4 py-3">
        ⓘ {report.notice}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '총 클릭', value: report.totals.clicks.toLocaleString() },
          { label: '고유 방문자', value: report.totals.uniqueVisitors.toLocaleString() },
          { label: '제출된 리뷰', value: report.totals.reviews.toLocaleString() },
          { label: '리뷰당 평균 유입', value: report.totals.avgClicksPerReview ?? '-' },
        ].map(s => (
          <div key={s.label} className="bg-paper rounded-box p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="text-2xl font-bold text-ink tabular-nums mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-paper rounded-box p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-ink">일별 추이 <span className="text-xs text-muted font-normal">{report.range.from} ~ {report.range.to}</span></h4>
          <button type="button" onClick={() => setShowTable(v => !v)} className="text-xs text-ink-2 underline">{showTable ? '차트로 보기' : '표로 보기'}</button>
        </div>
        {showTable ? (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted"><tr><th className="text-left py-1">날짜</th><th className="text-right">총 클릭</th><th className="text-right">고유 방문자</th></tr></thead>
              <tbody>{report.daily.map(d => (
                <tr key={d.day} className="border-t"><td className="py-1">{d.day}</td><td className="text-right tabular-nums">{d.clicks}</td><td className="text-right tabular-nums">{d.uniqueVisitors}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <DailyChart data={report.daily} />}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-paper rounded-box p-5">
          <h4 className="font-semibold text-ink mb-3">기기 비율</h4>
          {[['모바일', report.devices.mobile], ['PC', report.devices.pc], ['기타', report.devices.unknown]].map(([label, n]) => (
            <div key={label as string} className="mb-2">
              <div className="flex justify-between text-sm text-ink-2"><span>{label}</span><span className="tabular-nums">{n as number} ({pct(n as number, deviceTotal)})</span></div>
              <div className="h-2 bg-cream rounded-full mt-1"><div className="h-2 rounded-full bg-cream0" style={{ width: deviceTotal ? `${((n as number) / deviceTotal) * 100}%` : 0 }} /></div>
            </div>
          ))}
          {report.topReferers.length > 0 && (
            <p className="text-xs text-muted mt-3">주요 유입 경로: {report.topReferers.slice(0, 3).map(r => `${r.domain} ${r.clicks}`).join(' · ')}</p>
          )}
        </div>
        <div className="bg-paper rounded-box p-5">
          <h4 className="font-semibold text-ink mb-3">대가 표시 준수</h4>
          <p className="text-3xl font-bold text-ink tabular-nums">{pct(compliant, submitted)}</p>
          <p className="text-xs text-muted mt-1">제출된 리뷰 {submitted}건 중 {compliant}건 확인 완료 · 확인 중 {report.disclosure.NEEDS_MANUAL_REVIEW ?? 0}건</p>
          <p className="text-xs text-muted mt-3">공정위 추천·보증 심사지침에 따라 제목 또는 본문 첫 부분의 경제적 이해관계 표시를 확인합니다.</p>
        </div>
      </div>

      <div className="bg-paper rounded-box p-5">
        <h4 className="font-semibold text-ink mb-3">리뷰·체험단원별 유입 순위</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="text-left py-2">순위</th><th className="text-left">체험단원</th><th className="text-left">리뷰</th><th className="text-left">대가 표시</th><th className="text-right">클릭</th><th className="text-right">고유 방문자</th></tr>
            </thead>
            <tbody>
              {report.ranking.map((r, i) => (
                <tr key={r.linkCode} className="border-t">
                  <td className="py-2 text-muted">{i + 1}</td>
                  <td>{r.participantName}</td>
                  <td>{r.postUrl ? <a href={r.postUrl} target="_blank" rel="noreferrer" className="text-ink-2 underline">글 보기</a> : <span className="text-muted">미제출</span>}</td>
                  <td><span className={`text-xs px-1.5 py-0.5 rounded ${DISCLOSURE_LABEL[r.disclosure]?.cls ?? ''}`}>{DISCLOSURE_LABEL[r.disclosure]?.label ?? r.disclosure}</span></td>
                  <td className="text-right tabular-nums font-medium">{r.clicks}</td>
                  <td className="text-right tabular-nums">{r.uniqueVisitors}</td>
                </tr>
              ))}
              {report.ranking.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">아직 승인된 체험단원이 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
