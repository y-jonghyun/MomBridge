'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

const REASON_LABEL: Record<string, string> = {
  FETCH_FAILED: '게시글을 불러오지 못함',
  POST_NOT_FOUND: '공개 게시글을 찾지 못함 (비공개·삭제 확인)',
  DISCLOSURE_NOT_FOUND: '대가 표시 문구를 텍스트로 찾지 못함 (이미지 표시 여부 확인)',
  DISCLOSURE_NOT_AT_TOP: '대가 표시가 제목·첫 부분이 아닌 곳에 있음',
};
const WARNING_LABEL: Record<string, string> = {
  NO_TRACKING_LINK: '추적 링크 없음',
  NO_MAIN_KEYWORD: '메인 키워드 없음',
  TOP_IMAGE_PRESENT: '본문 첫 요소가 이미지 — 이미지 속 대가 표시 확인 필요',
};

/** 검수 카드 안의 자동 확인 결과 + 수동 확인 */
export function SubmissionCheckPanel({ submission, onConfirmed }: { submission: any; onConfirmed: (updated: any) => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const r = submission.postCheckResult;
  if (!submission.disclosureCheck) return null;

  async function confirm() {
    setSaving(true);
    try {
      const res = await api.post(`/submissions/${submission.id}/disclosure-confirm`, { reason });
      onConfirmed(res.data.data);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '처리 실패');
    } finally { setSaving(false); }
  }

  const state = submission.disclosureCheck;
  return (
    <div className={`rounded-lg p-3 mb-3 text-sm border ${state === 'NEEDS_MANUAL_REVIEW' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <p className="font-medium">
        {state === 'AUTO_PASSED' && '✓ 대가 표시 자동 확인'}
        {state === 'MANUAL_CONFIRMED' && '✓ 대가 표시 운영자 확인'}
        {state === 'NEEDS_MANUAL_REVIEW' && '! 대가 표시 수동 확인 필요 — 확인 전에는 승인할 수 없습니다'}
      </p>
      {r && (
        <ul className="mt-1 text-xs text-gray-700 space-y-0.5">
          {r.matchedPhrase && <li>찾은 문구: “{r.matchedPhrase}” ({r.disclosurePosition === 'TITLE' ? '제목' : r.disclosurePosition === 'TOP' ? '첫 부분' : '기타 위치'})</li>}
          {(r.manualReasons ?? []).map((x: string) => <li key={x}>· {REASON_LABEL[x] ?? x}</li>)}
          {(r.warnings ?? []).map((x: string) => <li key={x} className="text-gray-500">· {WARNING_LABEL[x] ?? x}</li>)}
          <li className="text-gray-400">확인 시각 {new Date(r.checkedAt).toLocaleString('ko-KR')}</li>
        </ul>
      )}
      {state === 'MANUAL_CONFIRMED' && (
        <p className="text-xs text-gray-600 mt-1">
          {submission.disclosureConfirmedBy?.user?.name ?? '운영자'} · {submission.disclosureConfirmedAt && new Date(submission.disclosureConfirmedAt).toLocaleString('ko-KR')} · 사유: {submission.disclosureConfirmNote}
        </p>
      )}
      {state === 'NEEDS_MANUAL_REVIEW' && (
        <div className="mt-2 flex gap-2">
          <input className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="확인 내용 (예: 본문 첫 이미지에 '제품 제공' 문구 확인)" />
          <button type="button" disabled={saving || reason.trim().length < 2} onClick={confirm}
            className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg disabled:opacity-50">직접 확인함</button>
        </div>
      )}
    </div>
  );
}

/** 유입 성과 (사업 성과보고용) + CSV 내보내기 */
export function TrafficSummary() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const query = () => {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    return q.toString();
  };

  async function load() {
    try { setData((await api.get(`/operator/reports/summary?${query()}`)).data.data); setError(''); }
    catch (err: any) { setError(err?.response?.data?.error?.message ?? '불러오기 실패'); }
  }

  async function downloadCsv() {
    const res = await api.get(`/operator/reports/export.csv?${query()}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mombridge-traffic-${data?.range.from ?? ''}_${data?.range.to ?? ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const inputCls = 'border rounded-lg px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">리뷰 유입 성과</h2>
      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-2">
        <div><label className="block text-xs text-gray-500 mb-1">시작일</label><input type="date" className={inputCls} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">종료일</label><input type="date" className={inputCls} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></div>
        <button onClick={load} className="px-4 py-2 border rounded-lg text-sm">조회</button>
        <button onClick={downloadCsv} disabled={!data} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm disabled:opacity-50 ml-auto">CSV 내보내기</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <>
          <p className="text-sm text-blue-900 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">ⓘ {data.notice}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['캠페인', data.total.campaigns], ['리뷰', data.total.reviews], ['총 클릭', data.total.clicks], ['리뷰당 평균 유입', data.total.avgClicksPerReview ?? '-']].map(([l, v]) => (
              <div key={l} className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500">{l}</p><p className="text-2xl font-bold tabular-nums">{typeof v === 'number' ? v.toLocaleString() : v}</p></div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-stone-50">
                <tr><th className="text-left px-3 py-2">캠페인</th><th className="text-left">고객사</th><th className="text-right">리뷰</th><th className="text-right">클릭</th><th className="text-right">고유</th><th className="text-right">리뷰당</th><th className="text-right px-3">대가표시</th></tr>
              </thead>
              <tbody>
                {data.campaigns.map((c: any) => (
                  <tr key={c.missionId} className="border-t">
                    <td className="px-3 py-2">{c.missionTitle}<span className="block text-xs text-gray-400">{c.campaignCode}</span></td>
                    <td>{c.businessName}</td>
                    <td className="text-right tabular-nums">{c.reviews}</td>
                    <td className="text-right tabular-nums font-medium">{c.clicks}</td>
                    <td className="text-right tabular-nums">{c.uniqueVisitors}</td>
                    <td className="text-right tabular-nums">{c.avgClicksPerReview ?? '-'}</td>
                    <td className="text-right tabular-nums px-3">{c.disclosureComplianceRate === null ? '-' : `${Math.round(c.disclosureComplianceRate * 100)}%`}</td>
                  </tr>
                ))}
                {data.campaigns.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">추적 링크가 발급된 캠페인이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const SETTING_LABEL: Record<string, { title: string; help: string }> = {
  'keyword.sort': { title: '키워드 정렬 기준', help: 'mode: recommended(추천 점수) | volume(검색량) | competition(경쟁 낮은 순). volumeBand: 적당한 검색량 구간, weights: 점수 가중치' },
  'submission.disclosurePhrases': { title: '대가 표시 인정 문구 (정규식)', help: "한 줄에 하나. '체험단', '선물' 등 공정위 지침상 불명확한 표현은 넣지 마세요" },
  'click.botRules': { title: '봇 제외 규칙', help: '[{"name": "규칙 이름", "pattern": "User-Agent 정규식"}] — 걸린 클릭은 집계에서 제외' },
};

/** 운영 설정 편집 (정렬 기준·대가 표시 문구·봇 규칙) */
export function SettingsEditor() {
  const [items, setItems] = useState<{ key: string; value: unknown; defaultValue: unknown }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const toText = (key: string, v: unknown) =>
    key === 'submission.disclosurePhrases' ? (v as string[]).join('\n') : JSON.stringify(v, null, 2);
  const fromText = (key: string, t: string) =>
    key === 'submission.disclosurePhrases' ? t.split('\n').map(s => s.trim()).filter(Boolean) : JSON.parse(t);

  async function load() {
    const r = await api.get('/operator/settings');
    setItems(r.data.data);
    setDrafts(Object.fromEntries(r.data.data.map((i: any) => [i.key, toText(i.key, i.value)])));
  }
  useEffect(() => { load(); }, []);

  async function save(key: string) {
    try {
      await api.put(`/operator/settings/${key}`, { value: fromText(key, drafts[key]) });
      setMsg(`${SETTING_LABEL[key]?.title ?? key} 저장됨`);
      load();
    } catch (err: any) {
      setMsg(err instanceof SyntaxError ? 'JSON 형식이 올바르지 않습니다' : err?.response?.data?.error?.message ?? '저장 실패');
    }
  }

  async function reset(key: string) {
    await api.delete(`/operator/settings/${key}`);
    setMsg('기본값으로 되돌렸습니다');
    load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">운영 설정</h2>
      {msg && <p className="text-sm bg-slate-50 border rounded-xl px-4 py-2">{msg}</p>}
      {items.map(i => (
        <div key={i.key} className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
          <p className="font-semibold text-gray-900">{SETTING_LABEL[i.key]?.title ?? i.key}</p>
          <p className="text-xs text-gray-500">{SETTING_LABEL[i.key]?.help}</p>
          <textarea rows={8} className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
            value={drafts[i.key] ?? ''} onChange={e => setDrafts(d => ({ ...d, [i.key]: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={() => save(i.key)} className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg">저장</button>
            <button onClick={() => reset(i.key)} className="px-4 py-2 border text-sm rounded-lg">기본값</button>
          </div>
        </div>
      ))}
    </div>
  );
}
