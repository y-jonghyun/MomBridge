/**
 * 플랫폼 수수료. 보상에서 떼는 비율을 한 곳에서만 정한다.
 *
 * 원 단위 아래는 버린다 — 화면이 보여 준 실수령액과 실제로 지급하는 금액이 어긋나면 안 된다.
 * 프론트는 frontend/src/lib/fees.ts에 같은 식이 있다. **바꿀 때는 둘 다 바꾼다.**
 * 이용약관 제8조의 "10%"도 같은 값이다.
 */
export const PLATFORM_FEE_RATE = 0.1;

/** 화면·문서에 적는 백분율 (10% 처럼) */
export const PLATFORM_FEE_PERCENT = Math.round(PLATFORM_FEE_RATE * 100);

/** 보상에서 떼는 수수료 (원 단위로 버림) */
export const platformFee = (reward: number) => Math.floor(Number(reward) * PLATFORM_FEE_RATE);

/** 수수료를 뺀 실지급액 (원 단위로 버림) */
export const netReward = (reward: number) => Math.floor(Number(reward)) - platformFee(reward);
