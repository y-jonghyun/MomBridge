/**
 * 공개 전 기능 잠금.
 *
 * 사업자등록·통신판매업 신고가 끝나기 전에는 고객사 결제를 받지 않는다.
 * 그동안 미션은 운영자 대행 등록(결제 면제)으로만 받는다.
 *
 * 등록이 끝나면 아래 한 줄을 true로 바꾸면 '미션 등록' 탭과 결제 버튼이 다시 나온다
 * (백엔드는 backend/src/config/features.ts의 같은 이름을 함께 바꾼다 — 둘 다 바꿔야 실제로 열린다).
 */
export const CLIENT_PAYMENT_ENABLED = false;
