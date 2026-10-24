import { z } from 'zod';
import { normalizeProvince } from '../../lib/regions';

/**
 * 고객사 가게 정보.
 * 미션을 등록하려면 상호·업종·주소·지역이 있어야 한다.
 * 사업자등록번호는 선택이지만, 적으면 형식을 본다.
 */

/** 사업자등록번호 10자리 검증 (국세청 체크섬) */
export function isBusinessNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i];
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(digits[9]);
}

/** 숫자만 남긴다 (123-45-67890 → 1234567890) */
export const normalizeBusinessNumber = (value: string) => value.replace(/\D/g, '');

/** 123-45-67890 */
export const formatBusinessNumber = (digits?: string | null) =>
  digits && digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : (digits ?? '');

export const storeSchema = z.object({
  businessName: z.string().trim().min(1, '상호를 입력해 주세요').max(200),
  businessCategory: z.enum(['FOOD', 'CAFE', 'KIDS', 'BEAUTY', 'LIVING', 'ETC'], { error: '업종을 골라 주세요' }),
  address: z.string().trim().min(1, '사업장 주소를 입력해 주세요').max(500),
  regionSi: z.string().trim().min(1, '시·도를 선택해 주세요').max(50).transform((v, ctx) => {
    const name = normalizeProvince(v);
    if (!name) { ctx.addIssue({ code: 'custom', message: '시·도를 선택해 주세요 (예: 충청북도)' }); return z.NEVER; }
    return name;
  }),
  regionGu: z.string().trim().min(1, '시·군·구를 선택해 주세요').max(50),
  regionDong: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().trim().max(50).optional()),
  businessNumber: z.preprocess(
    v => (v === '' || v === null ? undefined : v),
    z.string().trim().max(20)
      .transform(normalizeBusinessNumber)
      .refine(isBusinessNumber, '사업자등록번호 10자리를 다시 확인해 주세요')
      .optional(),
  ),
  description: z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().trim().max(2000).optional()),
});

/** 미션을 등록할 수 있는 상태인지 */
export function isStoreComplete(profile: {
  businessName: string; businessCategory: string | null; address: string; regionSi: string; regionGu: string;
}): boolean {
  return !!profile.businessName.trim() && !!profile.businessCategory
    && !!profile.address.trim() && !!profile.regionSi.trim() && !!profile.regionGu.trim();
}

/** 무엇이 비었는지 — 화면 안내용 */
export function missingStoreParts(profile: {
  businessName: string; businessCategory: string | null; address: string; regionSi: string; regionGu: string;
}): string[] {
  const missing: string[] = [];
  if (!profile.businessName.trim()) missing.push('상호');
  if (!profile.businessCategory) missing.push('업종');
  if (!profile.address.trim()) missing.push('사업장 주소');
  if (!profile.regionSi.trim() || !profile.regionGu.trim()) missing.push('지역');
  return missing;
}
