import Link from 'next/link';
import { ArrowRightIcon } from '@/components/ui/icons';
import { SHORT_LABELS, type NextStep } from '@/lib/next-step';

/**
 * 로그인 후 홈 맨 위 '내 미션 다음 단계' 카드 (app-feel 1단계 시안).
 * 칩에 지금 할 일, 가운데 미션 이름, 아래 다섯 단계 가로 막대. 누르면 내 활동으로 간다.
 */
export default function NextStepCard({ step }: { step: NextStep }) {
  const current = step.steps.findIndex(s => s.state === 'current');
  return (
    <Link
      href={step.href}
      aria-label={`내 미션 다음 단계: ${step.title}, ${step.chip}`}
      className="press block rounded-card border border-line bg-paper px-4 pb-3.5 pt-4 text-ink"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-[26px] items-center rounded-full bg-clay-tint px-2.5 text-[12.5px] font-bold text-clay-dark">
          {step.chip}
        </span>
        <span className="flex items-center gap-1 text-[12.5px] text-muted">
          {step.count}
          <ArrowRightIcon size={12} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2.5 line-clamp-2 break-keep text-base font-bold leading-[1.4]">{step.title}</p>

      {/* 가로 단계 막대 — 점 다섯 개를 선으로 잇는다 */}
      <div aria-hidden="true" className="mt-3.5 flex items-center px-[9px]">
        {step.steps.map((s, i) => (
          <div key={s.label} className={`flex items-center ${i < step.steps.length - 1 ? 'flex-1' : ''}`}>
            <span
              className={`block h-2.5 w-2.5 shrink-0 rounded-full ${
                s.state === 'done' ? 'bg-clay'
                : s.state === 'current' ? 'border-[2.5px] border-clay bg-paper'
                : 'bg-line'
              }`}
            />
            {i < step.steps.length - 1 && (
              <span className={`mx-1 block h-0.5 flex-1 rounded-full ${s.state === 'done' ? 'bg-clay' : 'bg-line'}`} />
            )}
          </div>
        ))}
      </div>
      <ol className="m-0 mt-1.5 flex list-none justify-between p-0 text-xs">
        {SHORT_LABELS.map((label, i) => (
          <li
            key={label}
            className={`w-7 text-center ${i === current ? 'font-bold text-clay-dark' : 'text-muted'}`}
            aria-current={i === current ? 'step' : undefined}
          >
            {label}
          </li>
        ))}
      </ol>
    </Link>
  );
}
