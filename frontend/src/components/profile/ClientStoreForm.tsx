'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import DistrictSelect from '@/components/common/DistrictSelect';
import { normalizeProvince } from '@/lib/regions';
import { BUSINESS_CATEGORIES } from '@/lib/mission-options';

/**
 * 고객사 가게 정보 — 상호 · 업종 · 사업장 주소 · 지역 · 사업자등록번호(선택).
 * 가입 직후 안내 화면과 '내 정보' 탭이 같은 이 컴포넌트를 쓴다.
 * 다 채워야 미션을 등록할 수 있다.
 */

export interface StoreProfile {
  businessName: string; businessCategory: string | null; address: string;
  regionSi: string; regionGu: string; regionDong: string | null;
  businessNumber: string | null; complete: boolean; missing: string[];
}

const input = 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';
const label = 'mb-1 block text-sm font-medium text-ink-2';

/** 123-45-67890 모양으로 보여 준다 */
function formatBusinessNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function ClientStoreForm({ onComplete }: { onComplete?: (complete: boolean) => void }) {
  const [form, setForm] = useState({
    businessName: '', businessCategory: '', address: '',
    regionSi: '', regionGu: '', regionDong: '', businessNumber: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/client/profile');
    const p: StoreProfile = data.data;
    setForm({
      businessName: p.businessName ?? '',
      businessCategory: p.businessCategory ?? '',
      address: p.address ?? '',
      regionSi: normalizeProvince(p.regionSi ?? ''),
      regionGu: p.regionGu ?? '',
      regionDong: p.regionDong ?? '',
      businessNumber: p.businessNumber ?? '',
    });
    setLoaded(true);
    onComplete?.(p.complete);
  }, [onComplete]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put('/client/profile', form);
      setMsg('저장했어요');
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e2?.response?.data?.error?.message ?? '저장하지 못했어요');
    } finally { setSaving(false); }
  }

  if (!loaded) return <p className="px-5 py-10 text-sm text-muted">불러오는 중…</p>;

  return (
    <form onSubmit={save} className="space-y-4 rounded-box border border-line bg-paper p-6">
      {msg && <p className="rounded-card border border-line bg-cream px-4 py-2 text-sm text-ink-2">{msg}</p>}

      <div>
        <label htmlFor="cs-name" className={label}>상호 *</label>
        <input id="cs-name" required className={input} value={form.businessName}
          onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="예: 마포 감성카페 브루잉" />
      </div>

      <div>
        <label htmlFor="cs-category" className={label}>업종 *</label>
        <select id="cs-category" required className={input} value={form.businessCategory}
          onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))}>
          <option value="">업종을 골라 주세요</option>
          {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">미션을 등록할 때 이 업종이 기본으로 들어갑니다.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cs-si" className={label}>시·도 *</label>
          <ProvinceSelect required value={form.regionSi}
            onChange={v => setForm(f => ({ ...f, regionSi: v, regionGu: '' }))} />
        </div>
        <div>
          <label htmlFor="cs-gu" className={label}>시·군·구 *</label>
          <DistrictSelect id="cs-gu" required province={form.regionSi}
            value={form.regionGu} onChange={v => setForm(f => ({ ...f, regionGu: v }))} />
        </div>
      </div>

      <div>
        <label htmlFor="cs-dong" className={label}>동 (선택)</label>
        <input id="cs-dong" className={input} value={form.regionDong}
          onChange={e => setForm(f => ({ ...f, regionDong: e.target.value }))} placeholder="예: 합정동" />
      </div>

      <div>
        <label htmlFor="cs-address" className={label}>사업장 주소 *</label>
        <input id="cs-address" required className={input} value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="예: 서울시 마포구 합정동 123 1층" />
        <p className="mt-1 text-xs text-muted">체험단원이 찾아올 주소예요. 미션을 등록할 때 자동으로 들어갑니다.</p>
      </div>

      <div>
        <label htmlFor="cs-bizno" className={label}>사업자등록번호 (선택)</label>
        <input id="cs-bizno" inputMode="numeric" maxLength={12} className={input} value={form.businessNumber}
          onChange={e => setForm(f => ({ ...f, businessNumber: formatBusinessNumber(e.target.value) }))}
          placeholder="123-45-67890" />
      </div>

      {error && <p className="text-[13px] text-clay-dark">{error}</p>}

      <button type="submit" disabled={saving}
        className="h-12 w-full rounded-card bg-ink text-sm font-bold text-paper disabled:opacity-50">
        {saving ? '저장 중…' : '가게 정보 저장'}
      </button>
    </form>
  );
}
