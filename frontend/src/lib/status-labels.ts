/**
 * 상태값의 한글 이름. 화면에 영문 코드가 그대로 나오지 않게 한 곳에서 관리한다.
 * (고객사 리포트의 '제출된 콘텐츠'에 APPROVED가 그대로 보이던 일이 있었다)
 */

/** 미션 상태 */
export const MISSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료',
};

/** 지원·제출·정산 상태 (한 축으로 쓰인다) */
export const RECORD_STATUS_LABEL: Record<string, string> = {
  // 지원
  PENDING: '검토 중', APPROVED: '승인됨', REJECTED: '반려', CANCELED: '취소',
  // 제출(검수)
  SUBMITTED: '검수 중', REVISION: '수정 요청',
  // 정산
  PENDING_PAYOUT: '정산 대기', COMPLETED: '지급 완료',
};

/** 콘텐츠 검수 상태 — 모르는 값이면 코드 대신 '상태 확인 중'을 보여 준다 */
export const submissionStatusLabel = (status: string) => RECORD_STATUS_LABEL[status] ?? '상태 확인 중';

/** 검수 상태 배지 색 */
export const submissionStatusTone = (status: string) =>
  status === 'APPROVED' ? 'bg-sage-tint text-sage'
    : status === 'REJECTED' ? 'border border-line text-muted'
      : 'bg-clay-tint text-clay-dark';
