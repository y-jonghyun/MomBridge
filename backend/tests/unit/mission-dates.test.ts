import { operatorCreateMissionSchema } from '../../src/modules/missions/missions.schema';

/** 날짜 순서: 신청 시작 ≤ 신청 마감 ≤ 선정 발표 ≤ 후기 마감 */
describe('미션 날짜 순서', () => {
  const base = {
    title: '미션', description: '설명', category: 'SNS',
    regionSi: '서울특별시', regionGu: '마포구',
    maxParticipants: 5, rewardAmount: 30000,
    startDate: '2026-11-01', endDate: '2026-11-10',
    announceDate: '2026-11-12', submissionDeadline: '2026-11-20',
  };

  const parse = (over: Record<string, unknown>) => operatorCreateMissionSchema.safeParse({ ...base, ...over });
  const errorPaths = (r: ReturnType<typeof parse>) =>
    r.success ? [] : r.error.issues.map(i => i.path.join('.'));

  it('순서가 맞으면 통과한다', () => {
    expect(parse({}).success).toBe(true);
    // 같은 날이어도 된다 (하루짜리 일정)
    expect(parse({ endDate: '2026-11-01', announceDate: '2026-11-01', submissionDeadline: '2026-11-01' }).success).toBe(true);
  });

  it('신청 마감이 시작보다 앞서면 거절한다', () => {
    expect(errorPaths(parse({ endDate: '2026-10-31' }))).toContain('endDate');
  });

  it('선정 발표가 신청 마감보다 앞서면 거절한다', () => {
    expect(errorPaths(parse({ announceDate: '2026-11-09' }))).toContain('announceDate');
  });

  it('후기 마감이 선정 발표보다 앞서면 거절한다', () => {
    expect(errorPaths(parse({ submissionDeadline: '2026-11-11' }))).toContain('submissionDeadline');
  });

  it('선정 발표일이 비어 있으면 신청 마감과 후기 마감만 본다', () => {
    expect(parse({ announceDate: '', submissionDeadline: '2026-11-11' }).success).toBe(true);
    expect(errorPaths(parse({ announceDate: '', submissionDeadline: '2026-11-09' }))).toContain('submissionDeadline');
  });

  it('여러 곳이 어긋나면 모두 알려준다', () => {
    const paths = errorPaths(parse({ endDate: '2026-10-20', announceDate: '2026-10-10', submissionDeadline: '2026-10-05' }));
    expect(paths).toEqual(expect.arrayContaining(['endDate', 'announceDate', 'submissionDeadline']));
  });
});
