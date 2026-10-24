/**
 * 플랫폼 수수료. 보상에서 떼는 비율을 한 곳에서만 정한다.
 *
 * 화면 여러 곳(미션 상세의 실수령액, 목록 카드, 소개 페이지의 보상 예시)이 같은 값을 써야 하므로
 * 비율을 각자 적어 두지 않는다. 서버가 계산한 실수령액이 내려오면 그 값을 우선 쓴다.
 * 약관(이용약관 제N조)과 백엔드 정산 계산도 같은 10%를 쓴다 — 바꿀 때는 함께 바꾼다.
 */
export const PLATFORM_FEE_RATE = 0.1;

/** 화면에 적는 백분율 (10% 처럼) */
export const PLATFORM_FEE_PERCENT = Math.round(PLATFORM_FEE_RATE * 100);

/** 보상에서 떼는 수수료 (원 단위로 버림) */
export const platformFee = (reward: number) => Math.floor(Number(reward) * PLATFORM_FEE_RATE);

/** 수수료를 뺀 실수령액 (원 단위로 버림) */
export const netReward = (reward: number) => Math.floor(Number(reward)) - platformFee(reward);
