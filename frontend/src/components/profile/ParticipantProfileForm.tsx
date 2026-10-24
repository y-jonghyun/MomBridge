'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import DistrictSelect from '@/components/common/DistrictSelect';
import { normalizeProvince } from '@/lib/regions';
import { CHILD_AGE_GROUPS, SNS_LABEL, SNS_PLATFORMS } from '@/lib/mission-options';

/**
 * 참여자 프로필 — 활동 지역 · SNS 계정 · 자녀 연령대.
 * 가입 직후 안내 화면과 '내 정보' 탭이 같은 이 컴포넌트를 쓴다.
 */

export interface SnsAccount { id: string; platform: string; handle: string; url: string }
export interface ParticipantProfile {
  regionSi: string; regionGu: string; regionDong: string | null;
  childAgeGroups: string[]; snsAccounts: SnsAccount[]; complete: boolean;
}

const input = 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';
const label = 'mb-1 block text-sm font-medium text-ink-2';

export default function ParticipantProfileForm({ onComplete }: { onComplete?: (complete: boolean) => void }) {
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [region, setRegion] = useState({ regionSi: '', regionGu: '', regionDong: '' });
  const [ages, setAges] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // 새 SNS 채널 입력
  const [sns, setSns] = useState({ platform: 'NAVER_BLOG', url: '' });
  const [snsError, setSnsError] = useState('');
  const [snsBusy, setSnsBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/participant/profile');
    const p: ParticipantProfile = data.data;
    setProfile(p);
    setRegion({ regionSi: normalizeProvince(p.regionSi ?? ''), regionGu: p.regionGu ?? '', regionDong: p.regionDong ?? '' });
    setAges(p.childAgeGroups ?? []);
    onComplete?.(p.complete);
  }, [onComplete]);

  useEffect(() => { void load(); }, [load]);

  async function saveRegion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put('/participant/profile', { ...region, childAgeGroups: ages });
      setMsg('저장했어요');
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e2?.response?.data?.error?.message ?? '저장하지 못했어요');
    } finally { setSaving(false); }
  }

  async function addSns(e: React.FormEvent) {
    e.preventDefault();
    setSnsError('');
    setSnsBusy(true);
    try {
      await api.post('/participant/profile/sns', sns);
      setSns({ platform: 'NAVER_BLOG', url: '' });
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      setSnsError(e2?.response?.data?.error?.message ?? '등록하지 못했어요');
    } finally { setSnsBusy(false); }
  }

  async function removeSns(id: string) {
    try {
      await api.delete(`/participant/profile/sns/${id}`);
      await load();
    } catch { setSnsError('지우지 못했어요'); }
  }

  if (!profile) return <p className="px-5 py-10 text-sm text-muted">불러오는 중…</p>;

  const taken = new Set(profile.snsAccounts.map(a => a.platform));
  const addable = SNS_PLATFORMS.filter(([v]) => !taken.has(v));

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-card border border-line bg-cream px-4 py-2 text-sm text-ink-2">{msg}</p>}

      {/* 활동 지역 + 자녀 연령대 */}
      <form onSubmit={saveRegion} className="space-y-4 rounded-card border border-line bg-paper p-[18px]">
        <div>
          <h3 className="font-serif text-section-sm font-bold text-ink">활동 지역</h3>
          <p className="mt-0.5 text-xs text-muted">내 동네 미션을 먼저 보여 드려요. 꼭 입력해 주세요.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pp-si" className={label}>시·도 *</label>
            <ProvinceSelect required value={region.regionSi}
              onChange={v => setRegion(r => ({ ...r, regionSi: v, regionGu: '' }))} />
          </div>
          <div>
            <label htmlFor="pp-gu" className={label}>시·군·구 *</label>
            <DistrictSelect id="pp-gu" required province={region.regionSi}
              value={region.regionGu} onChange={v => setRegion(r => ({ ...r, regionGu: v }))} />
          </div>
        </div>
        <div>
          <label htmlFor="pp-dong" className={label}>동 (선택)</label>
          <input id="pp-dong" className={input} value={region.regionDong}
            onChange={e => setRegion(r => ({ ...r, regionDong: e.target.value }))} placeholder="예: 합정동" />
        </div>

        <div>
          <span className={label}>자녀 연령대 (선택)</span>
          <div className="flex flex-wrap gap-2">
            {CHILD_AGE_GROUPS.map(([v, l]) => {
              const on = ages.includes(v);
              return (
                <button key={v} type="button" aria-pressed={on}
                  onClick={() => setAges(prev => (on ? prev.filter(a => a !== v) : [...prev, v]))}
                  className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] ${
                    on ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'
                  }`}>
                  {l}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">아이 동반 가능한 미션을 고를 때 참고해요.</p>
        </div>

        {error && <p className="text-[13px] text-clay-dark">{error}</p>}
        <button type="submit" disabled={saving}
          className="flex h-12 w-full items-center justify-center rounded-control bg-ink text-sm font-bold text-paper disabled:opacity-50">
          {saving ? '저장 중…' : '활동 지역 저장'}
        </button>
      </form>

      {/* SNS 계정 */}
      <section className="space-y-4 rounded-card border border-line bg-paper p-[18px]">
        <div>
          <h3 className="font-serif text-section-sm font-bold text-ink">SNS 계정</h3>
          <p className="mt-0.5 break-keep text-xs leading-[1.6] text-muted">
            후기를 올릴 채널이에요. 하나 이상 등록해야 미션에 지원할 수 있어요.
            고객사에게는 선정된 뒤 제출한 후기를 통해서만 보여요.
          </p>
        </div>

        {profile.snsAccounts.length > 0 && (
          <ul className="space-y-2">
            {profile.snsAccounts.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-control border border-line bg-cream px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{SNS_LABEL[a.platform] ?? a.platform}</p>
                  <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted underline">
                    {a.url}
                  </a>
                </div>
                <button type="button" onClick={() => void removeSns(a.id)}
                  className="h-9 shrink-0 rounded-control border border-clay-dark px-3 text-xs font-medium text-clay-dark">
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        {addable.length > 0 ? (
          <form onSubmit={addSns} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select value={sns.platform} onChange={e => setSns(s => ({ ...s, platform: e.target.value }))}
                aria-label="채널 종류"
                className="h-11 shrink-0 rounded-control border border-line bg-paper px-3 text-sm outline-none focus:border-ink">
                {addable.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={sns.url} onChange={e => setSns(s => ({ ...s, url: e.target.value }))}
                aria-label="채널 주소"
                placeholder={SNS_PLATFORMS.find(([v]) => v === sns.platform)?.[2]}
                className="h-11 min-w-0 flex-1 rounded-control border border-line bg-paper px-3 text-sm outline-none focus:border-ink" />
            </div>
            {snsError && <p className="text-[13px] text-clay-dark">{snsError}</p>}
            <button type="submit" disabled={snsBusy || !sns.url.trim()}
              className="flex h-11 w-full items-center justify-center rounded-control border border-line bg-cream text-sm font-medium text-ink-2 disabled:opacity-50">
              {snsBusy ? '등록 중…' : '채널 등록'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-muted">등록할 수 있는 채널을 모두 등록했어요.</p>
        )}
      </section>
    </div>
  );
}
