'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Modal } from '@/components/ui';
import ProvinceSelect from '@/components/common/ProvinceSelect';
import DistrictSelect from '@/components/common/DistrictSelect';
import { BUSINESS_CATEGORIES } from '@/lib/mission-options';
import { formatPhone } from '@/lib/phone';
import { normalizeProvince } from '@/lib/regions';
import type { ClientOption } from './RegisterMissionForm';

/**
 * 가게 정보 창 — 새로 등록할 때와 고칠 때 **같은 폼**을 쓴다.
 *
 * - 등록: 가입하지 않은 가게를 운영자가 고객사 목록에 올린다. 만들어지는 계정은 로그인할 수 없고
 *   메일·알림도 나가지 않는다. 사장님 계정을 이어 붙이는 '초대'는 따로 만든다.
 * - 수정: 운영자가 만든 가게와 직접 가입한 고객사 모두 고칠 수 있다.
 *   이메일·비밀번호는 여기서 바꾸지 않는다 (본인 계정의 로그인 수단이라서).
 */

const input = 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink';
const label = 'mb-1 block text-sm font-medium text-ink-2';

export default function ShopFormModal({ shop, onClose, onSaved }: {
  /** 고칠 가게. 없으면 새로 등록하는 창이 된다 */
  shop?: ClientOption | null;
  onClose: () => void;
  onSaved: (client: ClientOption) => void;
}) {
  const editing = !!shop;
  const [form, setForm] = useState({
    businessName: shop?.businessName ?? '',
    businessCategory: shop?.businessCategory ?? '',
    regionSi: shop?.regionSi ? normalizeProvince(shop.regionSi) : '',
    regionGu: shop?.regionGu ?? '',
    regionDong: shop?.regionDong ?? '',
    address: shop?.address ?? '',
    contactPhone: formatPhone(shop?.contactPhone ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName.trim()) { setError('가게 이름을 적어 주세요'); return; }
    if (!form.regionSi || !form.regionGu) { setError('시·도와 시·군·구를 골라 주세요'); return; }

    setSaving(true);
    setError('');
    const body = {
      businessName: form.businessName.trim(),
      businessCategory: form.businessCategory || undefined,
      regionSi: form.regionSi,
      regionGu: form.regionGu,
      // 수정할 때는 비운 것도 '지웠다'는 뜻이라 빈 문자열을 그대로 보낸다
      regionDong: editing ? form.regionDong.trim() : form.regionDong.trim() || undefined,
      address: editing ? form.address.trim() : form.address.trim() || undefined,
      contactPhone: editing ? form.contactPhone.trim() : form.contactPhone.trim() || undefined,
    };
    try {
      const { data } = editing
        ? await api.patch(`/operator/clients/${shop!.id}`, body)
        : await api.post('/operator/clients', body);
      onSaved(data.data);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e2?.response?.data?.error?.message ?? (editing ? '가게 정보를 고치지 못했어요' : '가게를 등록하지 못했어요'));
    } finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose} labelledBy="shop-form-title" className="max-w-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="shop-form-title" className="font-serif text-section font-bold text-ink">
            {editing ? '가게 정보 수정' : '가게 새로 등록'}
          </h2>
          <p className="mt-1 break-keep text-[13px] leading-[1.6] text-muted">
            {editing
              ? '이름·주소를 고치면 미션 화면에 바로 반영돼요. 이미 등록된 미션의 지역은 미션마다 따로 고쳐야 합니다.'
              : '가입하지 않은 가게도 등록할 수 있어요. 이 가게로 바로 미션을 대행 등록할 수 있습니다.'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="h-11 w-11 shrink-0 text-xl text-muted">×</button>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div>
          <label htmlFor="shop-name" className={label}>가게 이름 *</label>
          <input id="shop-name" required maxLength={200} className={input}
            placeholder="예: 마포 감성카페 브루잉"
            value={form.businessName} onChange={e => set('businessName', e.target.value)} />
        </div>

        <div>
          <label htmlFor="shop-category" className={label}>업종</label>
          <select id="shop-category" className={input}
            value={form.businessCategory} onChange={e => set('businessCategory', e.target.value)}>
            <option value="">선택 안 함</option>
            {BUSINESS_CATEGORIES.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>시·도 *</span>
            <ProvinceSelect required value={form.regionSi}
              onChange={v => { set('regionSi', v); set('regionGu', ''); }} className={input} />
          </div>
          <div>
            <label htmlFor="shop-gu" className={label}>시·군·구 *</label>
            <DistrictSelect id="shop-gu" required province={form.regionSi} value={form.regionGu}
              onChange={v => set('regionGu', v)} className={input} />
          </div>
        </div>

        <div>
          <label htmlFor="shop-dong" className={label}>동 (선택)</label>
          <input id="shop-dong" maxLength={50} className={input} placeholder="예: 합정동"
            value={form.regionDong} onChange={e => set('regionDong', e.target.value)} />
        </div>

        <div>
          <label htmlFor="shop-address" className={label}>주소 (선택)</label>
          <input id="shop-address" maxLength={500} className={input} placeholder="예: 서울시 마포구 합정동 123 1층"
            value={form.address} onChange={e => set('address', e.target.value)} />
        </div>

        <div>
          <label htmlFor="shop-phone" className={label}>대표 연락처 (선택)</label>
          <input id="shop-phone" type="tel" inputMode="tel" maxLength={13} className={input}
            placeholder="010-1234-5678"
            value={form.contactPhone} onChange={e => set('contactPhone', formatPhone(e.target.value))} />
          <p className="mt-1 break-keep text-xs text-muted">
            {editing && !shop?.managedByOperator
              ? '사장님이 직접 가입한 계정이에요. 이메일·비밀번호는 여기서 바꾸지 않습니다.'
              : '운영자가 연락할 때 쓰는 번호예요. 이 가게에는 결제 링크·알림톡을 보내지 않습니다.'}
          </p>
        </div>

        {error && <p className="text-[13px] text-clay-dark">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving}
            className="h-11 flex-1 rounded-control bg-ink text-sm font-bold text-paper disabled:opacity-50">
            {saving ? '저장 중…' : editing ? '수정 내용 저장' : '가게 등록'}
          </button>
          <button type="button" onClick={onClose}
            className="h-11 flex-1 rounded-control border border-line bg-paper text-sm text-ink-2">
            취소
          </button>
        </div>
      </form>
    </Modal>
  );
}
