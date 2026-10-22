// 약관·방침 시행일. 백엔드 src/modules/auth/consent.ts의 CONSENT_VERSION과 같아야 한다 (동의 기록에 이 버전이 남음)
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
 * 빈 값은 화면에 '게시 전 기재' 표시로 나온다 (components/legal/LegalPage의 BusinessValue).
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
