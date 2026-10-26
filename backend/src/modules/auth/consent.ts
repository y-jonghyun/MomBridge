import { z } from 'zod';

/**
 * 약관·방침 동의 버전.
 *
 * 회원에게 불리해지거나 처리 범위가 넓어지는 변경일 때만 올린다 — 올리면 다시 동의를 받는다.
 * 제공 범위가 좁아지는 변경(가림 처리 추가 등)은 화면의 시행일만 올리고 이 값은 그대로 둔다.
 * (frontend/src/lib/legal.ts의 주석에 어느 쪽인지 판단하는 기준을 적어 뒀다.
 *  그래서 PRIVACY 값과 화면의 시행일이 다를 수 있다 — 지금 방침 시행일은 2026-10-26이다.)
 */
export const CONSENT_VERSION = {
  AGE_14: '2026-10-23',
  TERMS: '2026-10-23',
  PRIVACY: '2026-10-23',
  MARKETING: '2026-10-23',
} as const;

// zod 4에서는 errorMap 대신 error를 쓴다 (문구는 그대로)
const mustAgree = (message: string) => z.literal(true, { error: message });

/** 회원가입 동의 항목: 필수 3개(만 14세 이상, 이용약관, 개인정보 수집·이용) + 선택 1개(마케팅 정보 수신) */
export const agreementsSchema = z.object({
  age14: mustAgree('만 14세 이상만 가입할 수 있습니다'),
  terms: mustAgree('이용약관에 동의해 주세요'),
  privacy: mustAgree('개인정보 수집·이용에 동의해 주세요'),
  marketing: z.boolean().optional().default(false),
// zod 4에서는 required_error·invalid_type_error가 error 하나로 합쳐졌다
}, { error: '약관 동의가 필요합니다' });

export type Agreements = z.infer<typeof agreementsSchema>;

export function consentRows(a: Agreements) {
  return [
    { type: 'AGE_14' as const, version: CONSENT_VERSION.AGE_14, agreed: a.age14 },
    { type: 'TERMS' as const, version: CONSENT_VERSION.TERMS, agreed: a.terms },
    { type: 'PRIVACY' as const, version: CONSENT_VERSION.PRIVACY, agreed: a.privacy },
    { type: 'MARKETING' as const, version: CONSENT_VERSION.MARKETING, agreed: a.marketing },
  ];
}
