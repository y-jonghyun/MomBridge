/** 미션 등록 폼에서 고르는 값들. 고객사 등록과 운영자 대행 등록이 같은 목록을 쓴다 */

/** 업종 — 유형(방문형·SNS·리뷰·영상)과는 다른 축 */
export const BUSINESS_CATEGORIES: [string, string][] = [
  ['FOOD', '맛집'], ['CAFE', '카페'], ['KIDS', '키즈'],
  ['BEAUTY', '뷰티'], ['LIVING', '생활'], ['ETC', '기타'],
];

/** 엄마 시간 태그 (복수 선택) */
export const MOM_TAGS: [string, string][] = [
  ['WEEKDAY_DAY', '평일 낮'], ['WEEKEND_OK', '주말 가능'],
  ['KID_FRIENDLY', '아이 동반 가능'], ['AT_HOME', '재택(배송형)'],
];

/** 자녀 연령대 (복수 선택, 선택 항목) */
export const CHILD_AGE_GROUPS: [string, string][] = [
  ['INFANT', '영아 (0~2세)'], ['TODDLER', '유아 (3~6세)'],
  ['ELEMENTARY', '초등'], ['NONE', '아이 없음'],
];

/** 등록할 수 있는 SNS 채널 */
export const SNS_PLATFORMS: [string, string, string][] = [
  ['NAVER_BLOG', '네이버 블로그', 'https://blog.naver.com/아이디'],
  ['INSTAGRAM', '인스타그램', 'https://instagram.com/아이디'],
  ['YOUTUBE', '유튜브', 'https://youtube.com/@아이디'],
];
export const SNS_LABEL: Record<string, string> = Object.fromEntries(SNS_PLATFORMS.map(([v, l]) => [v, l]));
