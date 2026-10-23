'use client';
import { useState } from 'react';
import api from '@/lib/api';

export interface KeywordPick {
  keyword: string;
  monthlyPcQc?: number | null;
  monthlyMobileQc?: number | null;
  isLowVolume?: boolean;
  compIdx?: 'low' | 'mid' | 'high' | 'unknown';
}

export interface KeywordSelection { main: KeywordPick; subs: KeywordPick[] }

interface Row {
  keyword: string;
  monthlyPc: number | null;
  monthlyPcLow: boolean;
  monthlyMobile: number | null;
  monthlyMobileLow: boolean;
  estimatedTotal: number;
  compIdx: 'low' | 'mid' | 'high' | 'unknown';
  score: number;
  isRegionCategory: boolean;
}

const COMP_LABEL = { low: '낮음', mid: '중간', high: '높음', unknown: '-' } as const;
const COMP_COLOR = { low: 'text-sage bg-sage-tint', mid: 'text-clay-dark bg-clay-tint', high: 'text-clay-dark bg-clay-tint', unknown: 'text-muted bg-cream' } as const;
const MAX_SUBS = 5;

function vol(value: number | null, low: boolean) {
  if (low) return <span className="text-muted">&lt;10</span>;
  return value === null ? <span className="text-muted">-</span> : value.toLocaleString();
}

const toPick = (r: Row): KeywordPick => ({
  keyword: r.keyword,
  monthlyPcQc: r.monthlyPc,
  monthlyMobileQc: r.monthlyMobile,
  isLowVolume: r.monthlyPcLow && r.monthlyMobileLow,
  compIdx: r.compIdx,
});

/** 광고주 키워드 추천: 기본 키워드 입력 → 연관 키워드 표 → 메인 1개 + 서브 확정 */
export default function KeywordRecommender({
  defaultCategory = '', defaultRegion = '', value, onChange,
}: {
  defaultCategory?: string;
  defaultRegion?: string;
  value: KeywordSelection | null;
  onChange: (v: KeywordSelection | null) => void;
}) {
  const [input, setInput] = useState({ category: defaultCategory, region: defaultRegion, product: '' });
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ source: string; cached: boolean; stale: boolean; fetchedAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    if (!input.category.trim() || !input.region.trim()) { setError('업종과 지역을 입력하세요'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await api.post('/keywords/recommend', { ...input, product: input.product || undefined });
      setRows(r.data.data.rows);
      setMeta(r.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? '키워드 조회에 실패했습니다');
    } finally { setLoading(false); }
  }

  function setMain(r: Row) {
    onChange({ main: toPick(r), subs: (value?.subs ?? []).filter(s => s.keyword !== r.keyword) });
  }

  function toggleSub(r: Row) {
    if (!value) return;
    const has = value.subs.some(s => s.keyword === r.keyword);
    if (!has && value.subs.length >= MAX_SUBS) { setError(`서브 키워드는 최대 ${MAX_SUBS}개입니다`); return; }
    onChange({ ...value, subs: has ? value.subs.filter(s => s.keyword !== r.keyword) : [...value.subs, toPick(r)] });
  }

  const inputCls = 'w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none';

  return (
    <div className="border rounded-card p-4 space-y-3 bg-cream">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">키워드 추천</p>
        {meta?.source === 'mock' && (
          <span className="text-xs bg-clay-tint text-clay-dark px-2 py-0.5 rounded-full">샘플 데이터 · 실제 검색량 아님</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className={inputCls} placeholder="업종 (예: 카페)" value={input.category} onChange={e => setInput(p => ({ ...p, category: e.target.value }))} />
        <input className={inputCls} placeholder="지역 (예: 마포구 망원동)" value={input.region} onChange={e => setInput(p => ({ ...p, region: e.target.value }))} />
        <input className={inputCls} placeholder="상품명 (선택)" value={input.product} onChange={e => setInput(p => ({ ...p, product: e.target.value }))} />
      </div>
      <button type="button" onClick={search} disabled={loading}
        className="px-4 py-2 bg-ink text-paper text-sm rounded-control disabled:opacity-50">
        {loading ? '조회 중...' : '연관 키워드 조회'}
      </button>
      {error && <p className="text-sm text-clay-dark">{error}</p>}
      {meta?.stale && <p className="text-xs text-clay-dark">키워드 도구가 잠시 응답하지 않아 {new Date(meta.fetchedAt).toLocaleDateString('ko-KR')}에 조회한 결과를 보여줍니다.</p>}

      {value && (
        <div className="text-sm bg-paper border rounded-control p-3">
          <p><span className="font-semibold text-ink-2">메인</span> {value.main.keyword}</p>
          <p className="mt-1"><span className="font-semibold text-ink-2">서브</span> {value.subs.length ? value.subs.map(s => s.keyword).join(', ') : <span className="text-muted">없음</span>}</p>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:text-clay-dark mt-1">선택 해제</button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto bg-paper border rounded-control">
          <table className="w-full text-sm">
            <thead className="bg-cream text-muted text-xs">
              <tr>
                <th className="text-left px-3 py-2">키워드</th>
                <th className="text-right px-2 py-2">PC</th>
                <th className="text-right px-2 py-2">모바일</th>
                <th className="text-right px-2 py-2">합계</th>
                <th className="px-2 py-2">경쟁</th>
                <th className="px-2 py-2">메인</th>
                <th className="px-2 py-2">서브</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map(r => {
                const isMain = value?.main.keyword === r.keyword;
                const isSub = value?.subs.some(s => s.keyword === r.keyword) ?? false;
                return (
                  <tr key={r.keyword} className={`border-t ${isMain ? 'bg-cream' : ''}`}>
                    <td className="px-3 py-2">
                      {r.keyword}
                      {r.isRegionCategory && <span className="ml-1 text-[10px] text-ink-2 bg-cream px-1.5 py-0.5 rounded">지역+업종</span>}
                    </td>
                    <td className="text-right px-2 py-2 tabular-nums">{vol(r.monthlyPc, r.monthlyPcLow)}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{vol(r.monthlyMobile, r.monthlyMobileLow)}</td>
                    <td className="text-right px-2 py-2 tabular-nums font-medium">{r.estimatedTotal.toLocaleString()}</td>
                    <td className="px-2 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${COMP_COLOR[r.compIdx]}`}>{COMP_LABEL[r.compIdx]}</span></td>
                    <td className="px-2 py-2 text-center"><input type="radio" aria-label={`${r.keyword} 메인`} checked={isMain} onChange={() => setMain(r)} /></td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" aria-label={`${r.keyword} 서브`} disabled={!value || isMain} checked={isSub} onChange={() => toggleSub(r)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted px-3 py-2 border-t">
            검색량은 최근 30일 합계입니다. 경쟁 정도는 네이버 PC 검색광고 기준이며 블로그 노출 경쟁과는 다를 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
