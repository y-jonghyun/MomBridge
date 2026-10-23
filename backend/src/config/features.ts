/**
 * 공개 전 기능 잠금.
 *
 * 사업자등록·통신판매업 신고가 끝나기 전에는 돈을 받을 수 없다.
 * 그동안 미션은 **운영자 대행 등록(결제 면제)** 으로만 받는다.
 *
 * 등록이 끝나면 아래 한 줄을 true로 바꾸면 고객사 결제가 다시 열린다
 * (프론트는 frontend/src/lib/features.ts의 같은 이름을 함께 바꾼다).
 */
export const CLIENT_PAYMENT_ENABLED = false;

/** 결제가 잠겨 있을 때 돌려줄 응답 */
export const paymentDisabledError = () => ({
  code: 'PAYMENT_DISABLED',
  message: '지금은 고객사 결제를 받지 않습니다. 미션 등록은 운영자에게 문의해 주세요',
});
