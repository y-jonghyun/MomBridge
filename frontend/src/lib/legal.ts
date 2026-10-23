/**
 * 약관·방침 시행일.
 *
 * ⚠️ 공개(머지)하는 날짜로 바꿀 때 **세 곳을 같은 값으로** 맞춰야 한다.
 *   1) 이 파일의 TERMS_EFFECTIVE_DATE · PRIVACY_EFFECTIVE_DATE  (화면에 보이는 시행일)
 *   2) backend/src/modules/auth/consent.ts 의 CONSENT_VERSION    (동의 기록에 남는 버전)
 * 백엔드가 기록한 버전과 화면에 보여준 시행일이 다르면, 회원이 무엇에 동의했는지 추적할 수 없다.
 * 공개한 뒤 문구를 고칠 때도 같은 방식으로 날짜를 올리고 재동의를 받는다.
 */
export const TERMS_EFFECTIVE_DATE = '2026-10-23';
export const PRIVACY_EFFECTIVE_DATE = '2026-10-23';

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
