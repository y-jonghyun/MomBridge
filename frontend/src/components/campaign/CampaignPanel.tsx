'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import KeywordRecommender, { KeywordSelection } from './KeywordRecommender';
import CampaignReport, { CampaignReportData } from './CampaignReport';

interface ShareLink { id: string; expiresAt: string; revokedAt: string | null; createdAt: string }

/** 광고주 미션 상세: 도착 URL·키워드 설정 + 성과 리포트 + 공유 링크 */
export default function CampaignPanel({ mission, defaultCategory, canShare = true }: {
  mission: { id: string; destinationUrl?: string | null; regionGu?: string; regionDong?: string | null };
  defaultCategory?: string;
  canShare?: boolean;
}) {
  const [report, setReport] = useState<CampaignReportData | null>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [destination, setDestination] = useState(mission.destinationUrl ?? '');
  const [keywords, setKeywords] = useState<KeywordSelection | null>(null);
  const [editKeywords, setEditKeywords] = useState(false);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [shareDays, setShareDays] = useState(7);
  const [newShareUrl, setNewShareUrl] = useState('');
  const [msg, setMsg] = useState('');

  async function loadReport() {
    const q = new URLSearchParams();
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    const r = await api.get(`/client/missions/${mission.id}/report?${q}`);
    setReport(r.data.data);
  }

  async function loadKeywords() {
    const r = await api.get(`/client/missions/${mission.id}/keywords`);
    const { main, subs } = r.data.data;
    setKeywords(main ? { main: { keyword: main.keyword }, subs: subs.map((s: any) => ({ keyword: s.keyword })) } : null);
  }

  async function loadShares() {
    if (!canShare) return;
    const r = await api.get(`/client/missions/${mission.id}/report/share`);
    setShares(r.data.data);
  }

  useEffect(() => {
    loadReport().catch(() => setMsg('리포트를 불러오지 못했습니다'));
    loadKeywords().catch(() => undefined);
    loadShares().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.id]);

  async function saveDestination() {
    try {
      await api.patch(`/client/missions/${mission.id}/destination`, { destinationUrl: destination });
      setMsg('도착 URL을 저장했습니다');
    } catch (err: any) { setMsg(err?.response?.data?.error?.message ?? '저장 실패'); }
  }

  async function saveKeywords() {
    if (!keywords) return;
    try {
      await api.put(`/client/missions/${mission.id}/keywords`, keywords);
      setEditKeywords(false);
      setMsg('키워드를 저장했습니다. 체험단원 가이드에 표시됩니다');
    } catch (err: any) { setMsg(err?.response?.data?.error?.message ?? '저장 실패'); }
  }

  async function createShare() {
    try {
      const r = await api.post(`/client/missions/${mission.id}/report/share`, { expiresInDays: shareDays });
      setNewShareUrl(r.data.data.url);
      loadShares();
    } catch (err: any) { setMsg(err?.response?.data?.error?.message ?? '공유 링크 생성 실패'); }
  }

  async function revokeShare(id: string) {
    await api.delete(`/client/missions/${mission.id}/report/share/${id}`);
    loadShares();
  }

  const inputCls = 'border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none';

  return (
    <div className="space-y-4">
      {msg && <div className="text-sm bg-slate-50 border rounded-xl px-4 py-2 text-slate-700">{msg}</div>}

      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <h4 className="font-semibold text-gray-900">캠페인 설정</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도착 URL (예약 페이지·스마트스토어·홈페이지)</label>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={destination} onChange={e => setDestination(e.target.value)} placeholder="https://" />
            <button type="button" onClick={saveDestination} className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg">저장</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">체험단원 글의 추적 링크를 누르면 이 주소로 이동합니다. 분석 도구에서 utm_source=mombridge로 확인할 수 있습니다.</p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">확정 키워드</p>
            <button type="button" onClick={() => setEditKeywords(v => !v)} className="text-xs text-slate-600 underline">{editKeywords ? '닫기' : '변경'}</button>
          </div>
          {!editKeywords && (
            <p className="text-sm text-gray-700 mt-1">
              {keywords ? <>메인 <b>{keywords.main.keyword}</b>{keywords.subs.length > 0 && <> · 서브 {keywords.subs.map(s => s.keyword).join(', ')}</>}</> : <span className="text-gray-400">아직 정하지 않았습니다</span>}
            </p>
          )}
          {editKeywords && (
            <div className="mt-2 space-y-2">
              <KeywordRecommender
                defaultCategory={defaultCategory}
                defaultRegion={[mission.regionGu, mission.regionDong].filter(Boolean).join(' ')}
                value={keywords}
                onChange={setKeywords}
              />
              <button type="button" onClick={saveKeywords} disabled={!keywords} className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg disabled:opacity-50">키워드 저장</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-2">
        <div><label className="block text-xs text-gray-500 mb-1">시작일</label><input type="date" className={inputCls} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">종료일</label><input type="date" className={inputCls} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></div>
        <button type="button" onClick={() => loadReport()} className="px-4 py-2 border rounded-lg text-sm">조회</button>
      </div>

      {report && <CampaignReport report={report} />}

      {canShare && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h4 className="font-semibold text-gray-900">리포트 공유</h4>
          <p className="text-xs text-gray-500">링크를 받은 사람은 로그인 없이 리포트를 볼 수 있습니다. 체험단원 이름은 가려집니다.</p>
          <div className="flex items-center gap-2">
            <select className={inputCls} value={shareDays} onChange={e => setShareDays(Number(e.target.value))}>
              {[1, 7, 14, 30].map(d => <option key={d} value={d}>{d}일 후 만료</option>)}
            </select>
            <button type="button" onClick={createShare} className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg">공유 링크 만들기</button>
          </div>
          {newShareUrl && (
            <div className="flex gap-2 items-center bg-stone-50 rounded-lg p-2">
              <input readOnly className={`${inputCls} flex-1 bg-white`} value={newShareUrl} />
              <button type="button" onClick={() => navigator.clipboard.writeText(newShareUrl)} className="px-3 py-2 border rounded-lg text-sm">복사</button>
            </div>
          )}
          {newShareUrl && <p className="text-xs text-amber-700">이 주소는 지금만 확인할 수 있습니다. 복사해 두세요.</p>}
          {shares.length > 0 && (
            <ul className="text-sm divide-y">
              {shares.map(s => {
                const expired = new Date(s.expiresAt) <= new Date();
                return (
                  <li key={s.id} className="flex justify-between py-2">
                    <span className="text-gray-600">{new Date(s.createdAt).toLocaleDateString('ko-KR')} 발급 · {new Date(s.expiresAt).toLocaleDateString('ko-KR')} 만료</span>
                    {s.revokedAt ? <span className="text-gray-400">폐기됨</span> : expired ? <span className="text-gray-400">만료됨</span>
                      : <button type="button" onClick={() => revokeShare(s.id)} className="text-red-500 text-xs">폐기</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
