import { CheckIcon } from '@/components/ui/icons';

/**
 * 내 활동 '진행 중' 카드의 세로 여정.
 * 서버에 있는 상태만으로 단계를 정한다 — 방문은 따로 기록하지 않으므로 "방문하고 후기 제출"로 합친다.
 *   신청(지원일) → 선정(검토일) → 방문하고 후기 제출(후기 마감) → 검수 → 보상 지급(정산일)
 */
export type StepState = 'done' | 'current' | 'todo';
export interface JourneyStep { label: string; detail?: string | null; state: StepState }

const monthDay = (d: string | Date) => { const t = new Date(d); return `${t.getMonth() + 1}월 ${t.getDate()}일`; };

/** 진행 중 신청 하나를 다섯 단계로 바꾼다 */
export function journeySteps({
  appliedAt, selectedAt, deadline, submissionStatus, revisionLeft, payoutCompleted, payoutDay, now = new Date(),
}: {
  appliedAt: string;
  selectedAt?: string | null;
  deadline?: string | null;
  /** 제출 전이면 null */
  submissionStatus?: 'SUBMITTED' | 'REVISION' | 'APPROVED' | 'REJECTED' | string | null;
  revisionLeft?: boolean;
  payoutCompleted?: boolean;
  /** 다음 정산일 ("12월 10일") */
  payoutDay?: string | null;
  now?: Date;
}): JourneyStep[] {
  const submitted = submissionStatus === 'SUBMITTED' || submissionStatus === 'APPROVED';
  const approved = submissionStatus === 'APPROVED';
  const dday = deadline ? Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400000) : null;
  const deadlineText = deadline
    ? `${monthDay(deadline)}까지${dday !== null && dday >= 0 ? ` · ${dday === 0 ? 'D-Day' : `D-${dday}`}` : ''}`
    : '일정 미정';

  return [
    { label: '신청', detail: monthDay(appliedAt), state: 'done' },
    { label: '선정', detail: selectedAt ? monthDay(selectedAt) : null, state: 'done' },
    {
      label: '방문하고 후기 제출',
      detail: submissionStatus === 'REVISION'
        ? (revisionLeft ? '수정 요청이 왔어요' : '수정 횟수를 모두 썼어요')
        : submitted ? '제출했어요' : deadlineText,
      state: submitted ? 'done' : 'current',
    },
    {
      label: '검수',
      detail: approved ? '통과했어요' : submissionStatus === 'SUBMITTED' ? '검수 중 · 보통 2일 안에 결과가 나와요' : '제출 후 보통 2일',
      state: approved ? 'done' : submissionStatus === 'SUBMITTED' ? 'current' : 'todo',
    },
    {
      label: '보상 지급',
      detail: payoutCompleted ? '지급했어요' : payoutDay ? `${payoutDay} 지급 예정` : '정산일에 지급',
      state: payoutCompleted ? 'done' : approved ? 'current' : 'todo',
    },
  ];
}

export default function MissionJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol aria-label="진행 단계" className="m-0 list-none p-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className={`relative flex gap-3.5 ${last ? '' : 'pb-3'}`}>
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[8px] top-5 -bottom-0.5 w-0.5 ${s.state === 'done' ? 'bg-clay' : 'bg-line'}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                s.state === 'done' ? 'bg-clay text-paper'
                : s.state === 'current' ? 'border-[3px] border-clay bg-paper'
                : 'border-2 border-line bg-paper'
              }`}
            >
              {s.state === 'done' && <CheckIcon size={11} strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <p className={`text-[14.5px] ${s.state === 'current' ? 'font-bold text-ink' : s.state === 'done' ? 'text-muted' : 'text-ink-2'}`}>
                {s.label}
                <span className="sr-only">{s.state === 'done' ? ' (끝남)' : s.state === 'current' ? ' (지금 단계)' : ''}</span>
              </p>
              {s.detail && (
                <p className={`mt-px break-keep text-[12.5px] ${s.state === 'current' ? 'font-medium text-clay-dark' : 'text-muted'}`}>{s.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
