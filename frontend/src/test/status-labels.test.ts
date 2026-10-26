import { describe, expect, it } from 'vitest';
import { MISSION_STATUS_LABEL, submissionStatusLabel } from '@/lib/status-labels';

/**
 * 고객사 리포트의 '제출된 콘텐츠'에 APPROVED 같은 영문 값이 그대로 보이던 문제.
 * 화면에 들어가는 상태값은 모두 한글 이름이 있어야 한다.
 */
describe('상태 이름', () => {
  it('검수 상태를 한글로 바꾼다', () => {
    expect(submissionStatusLabel('APPROVED')).toBe('승인됨');
    expect(submissionStatusLabel('SUBMITTED')).toBe('검수 중');
    expect(submissionStatusLabel('REJECTED')).toBe('반려');
    expect(submissionStatusLabel('REVISION')).toBe('수정 요청');
  });

  it('미션 상태도 한글로 바꾼다', () => {
    for (const status of ['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED']) {
      expect(MISSION_STATUS_LABEL[status]).toBeTruthy();
      expect(MISSION_STATUS_LABEL[status]).not.toMatch(/[A-Z_]{3,}/);
    }
  });

  it('모르는 값이 와도 영문 코드를 그대로 보여 주지 않는다', () => {
    expect(submissionStatusLabel('SOMETHING_NEW')).toBe('상태 확인 중');
    expect(submissionStatusLabel('')).toBe('상태 확인 중');
  });
});
