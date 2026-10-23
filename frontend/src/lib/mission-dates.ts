/**
 * 미션 날짜 순서 검사 — 신청 시작 ≤ 신청 마감 ≤ 선정 발표 ≤ 후기 마감.
 * 선정 발표일은 선택이라 비어 있으면 그 자리를 건너뛴다.
 *
 * 서버도 같은 순서로 막는다 (backend/src/modules/missions/missions.schema.ts의 checkDateOrder).
 * 여기서는 결제 창을 띄우기 전에 먼저 걸러 주기 위한 것이다.
 */
export interface MissionDates {
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  announceDate?: string;
}

/** 어긋난 곳이 있으면 안내 문구, 없으면 null */
export function missionDateError(d: MissionDates): string | null {
  const steps: [string, string][] = [
    ['신청 시작일', d.startDate],
    ['신청 마감일', d.endDate],
    ...(d.announceDate ? [['선정 발표일', d.announceDate] as [string, string]] : []),
    ['후기 마감일', d.submissionDeadline],
  ];

  for (let i = 1; i < steps.length; i++) {
    const [prevLabel, prev] = steps[i - 1];
    const [label, value] = steps[i];
    if (!prev || !value) continue; // 아직 비어 있는 칸은 required가 잡는다
    if (value < prev) return `${label}은 ${prevLabel} 이후여야 해요.`;
  }
  return null;
}
