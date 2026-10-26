/**
 * 약관·방침 시행일.
 *
 * 문서를 고칠 때는 **무엇이 바뀌는지**에 따라 올리는 값이 다르다.
 *
 * 1) 회원에게 불리해지거나 처리 범위가 넓어지는 변경 (받는 항목·제공처·목적이 늘어남)
 *    → 이 파일의 시행일과 backend/src/modules/auth/consent.ts 의 CONSENT_VERSION을
 *      **같은 날짜로 함께** 올린다. 버전이 올라가면 다시 동의를 받는다.
 * 2) 제공 범위가 좁아지거나 문구만 또렷해지는 변경 (가림 처리 추가, 오탈자 등)
 *    → 시행일만 올리고 CONSENT_VERSION은 그대로 둔다. 이미 받은 동의가 그대로 유효하다.
 *      화면의 '변경 이력'에 무엇이 바뀌었는지 한 줄을 남긴다.
 *
 * 어느 쪽이든 화면에 보여 준 시행일과 동의 기록이 어긋나면 회원이 무엇에 동의했는지
 * 추적할 수 없으니, 두 값의 관계를 바꿀 때는 이 주석도 함께 고친다.
 */
export const TERMS_EFFECTIVE_DATE = '2026-10-23';
export const PRIVACY_EFFECTIVE_DATE = '2026-10-26';

/**
 * 개인정보처리방침 변경 이력 (새 것이 위).
 * 재동의 없이 시행일만 올린 변경도 여기에 남긴다 — 무엇이 언제 바뀌었는지 보이게.
 */
export const PRIVACY_CHANGES: { date: string; summary: string }[] = [
  { date: '2026-10-26', summary: '고객사에 제공되는 참여자 이름을 일부 가림 처리' },
];

interface BusinessInfo {
  /** 상호 */
  name: string;
  /** 대표자 */
  owner: string;
  /** 사업자등록번호 */
  registrationNumber: string;
  /** 통신판매업 신고번호 */
  mailOrderNumber: string;
  /** 사업장 주소 */
  address: string;
  /** 문의 이메일 */
  inquiryEmail: string;
}

/**
 * 사업자 정보. 사업자등록 전이라 세 값이 비어 있다 —
 * 등록·신고가 끝나면 여기만 채우면 약관 부칙과 사이트 푸터에 함께 반영된다.
 * 아직 비어 있는 항목은 화면에서 그 줄이 **통째로 빠진다** (businessInfoParts).
 * 값을 넣으면 약관 부칙과 푸터에 저절로 나타난다.
 */
export const BUSINESS_INFO: BusinessInfo = {
  name: '맘브릿지',
  owner: '곽상미',
  registrationNumber: '',
  mailOrderNumber: '',
  address: '',
  inquiryEmail: 'soul0567@naver.com',
};

/** 개인정보 보호책임자 (개인정보 보호법 제31조) */
export const PRIVACY_OFFICER = {
  name: '곽상미',
  title: '대표',
  email: 'soul0567@naver.com',
  phone: '010-2915-0567',
} as const;

/** 분쟁의 관할 법원 (약관 제12조) */
export const GOVERNING_COURT = '청주지방법원';

/** 암호화된 데이터베이스 백업 보관 일수 (방침 6번) */
export const BACKUP_RETENTION_DAYS = 30;

/**
 * 약관 부칙·푸터에 쓸 사업자 정보 조각들. 아직 없는 값은 아예 넣지 않는다 —
 * 사업자등록 전에 '게시 전 기재' 같은 자리표시를 공개 화면에 내보내지 않기 위해서다.
 */
export function businessInfoParts(): string[] {
  const parts = [BUSINESS_INFO.name];
  if (BUSINESS_INFO.owner) parts.push(`대표 ${BUSINESS_INFO.owner}`);
  if (BUSINESS_INFO.registrationNumber) parts.push(`사업자등록번호 ${BUSINESS_INFO.registrationNumber}`);
  if (BUSINESS_INFO.mailOrderNumber) parts.push(`통신판매업 신고 ${BUSINESS_INFO.mailOrderNumber}`);
  if (BUSINESS_INFO.address) parts.push(BUSINESS_INFO.address);
  if (BUSINESS_INFO.inquiryEmail) parts.push(`문의 ${BUSINESS_INFO.inquiryEmail}`);
  return parts;
}

/** 위 조각들을 한 줄로 */
export const businessInfoLine = () => businessInfoParts().join(' · ');
