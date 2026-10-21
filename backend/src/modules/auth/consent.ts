import { z } from 'zod';

/** 약관·방침 문서 버전(시행일). 문서를 바꾸면 여기와 프론트 /terms·/privacy의 시행일을 함께 올린다 */
export const CONSENT_VERSION = {
  AGE_14: '2026-10-22',
  TERMS: '2026-10-22',
  PRIVACY: '2026-10-22',
  MARKETING: '2026-10-22',
} as const;

const mustAgree = (message: string) => z.literal(true, { errorMap: () => ({ message }) });

/** 회원가입 동의 항목: 필수 3개(만 14세 이상, 이용약관, 개인정보 수집·이용) + 선택 1개(마케팅 정보 수신) */
export const agreementsSchema = z.object({
  age14: mustAgree('만 14세 이상만 가입할 수 있습니다'),
  terms: mustAgree('이용약관에 동의해 주세요'),
  privacy: mustAgree('개인정보 수집·이용에 동의해 주세요'),
  marketing: z.boolean().optional().default(false),
}, { required_error: '약관 동의가 필요합니다', invalid_type_error: '약관 동의가 필요합니다' });

export type Agreements = z.infer<typeof agreementsSchema>;

export function consentRows(a: Agreements) {
  return [
    { type: 'AGE_14' as const, version: CONSENT_VERSION.AGE_14, agreed: a.age14 },
    { type: 'TERMS' as const, version: CONSENT_VERSION.TERMS, agreed: a.terms },
    { type: 'PRIVACY' as const, version: CONSENT_VERSION.PRIVACY, agreed: a.privacy },
    { type: 'MARKETING' as const, version: CONSENT_VERSION.MARKETING, agreed: a.marketing },
  ];
}
