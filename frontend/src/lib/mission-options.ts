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
