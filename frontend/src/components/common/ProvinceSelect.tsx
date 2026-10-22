import { PROVINCES } from '@/lib/regions';

/** 시·도 선택. 값은 정식 명칭(예: 충청북도)이고 화면에는 짧은 이름(충북)을 보여 준다 */
export default function ProvinceSelect({ value, onChange, required, emptyLabel = '시·도 선택', className }: {
  value: string; onChange: (v: string) => void; required?: boolean; emptyLabel?: string; className?: string;
}) {
  return (
    <select required={required} value={value} onChange={e => onChange(e.target.value)}
      className={className ?? 'w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-slate-500 focus:outline-none'}>
      <option value="">{emptyLabel}</option>
      <optgroup label="특별·광역시">
        {PROVINCES.filter(p => p.metro).map(p => <option key={p.name} value={p.name}>{p.short}</option>)}
      </optgroup>
      <optgroup label="도">
        {PROVINCES.filter(p => !p.metro).map(p => <option key={p.name} value={p.name}>{p.short}</option>)}
      </optgroup>
    </select>
  );
}
