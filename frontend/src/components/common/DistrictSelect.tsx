'use client';
import { useState } from 'react';
import { districtsOf } from '@/lib/districts';

/**
 * 시·군·구 선택. 고른 시·도에 맞는 목록을 보여 준다.
 *
 * 목록에 없는 동네도 넣을 수 있게 마지막에 '직접 입력'을 둔다 —
 * 행정구역이 바뀌어도 등록이 막히지 않게 하려는 것이다.
 */
export default function DistrictSelect({
  province, value, onChange, required, id, className,
}: {
  /** 시·도 정식 명칭 (예: 충청북도) */
  province: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
}) {
  const options = districtsOf(province);
  // 저장된 값이 목록에 없으면 처음부터 직접 입력으로 연다
  const [manual, setManual] = useState(() => !!value && options.length > 0 && !options.includes(value));

  const box = className ?? 'w-full rounded-control border border-line bg-paper px-3 py-2 text-sm outline-none';

  // 시·도를 고르기 전이거나 목록이 없는 시·도면 그냥 입력칸
  if (!province || options.length === 0 || manual) {
    return (
      <div className="flex gap-2">
        <input
          id={id} required={required} value={value} onChange={e => onChange(e.target.value)}
          placeholder={province ? '예: 마포구, 청주시 상당구' : '시·도를 먼저 골라 주세요'}
          disabled={!province}
          className={`${box} disabled:opacity-50`}
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => { setManual(false); onChange(''); }}
            className="shrink-0 rounded-control border border-line px-3 text-xs text-ink-2"
          >
            목록에서
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      id={id} required={required} value={value} className={box}
      onChange={e => {
        if (e.target.value === '__manual__') { setManual(true); onChange(''); return; }
        onChange(e.target.value);
      }}
    >
      <option value="">시·군·구 선택</option>
      {options.map(d => <option key={d} value={d}>{d}</option>)}
      <option value="__manual__">직접 입력…</option>
    </select>
  );
}
