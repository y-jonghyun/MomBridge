import Link from 'next/link';

/** 엄마 시간 태그 등 작은 사각 태그 (sage) */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-sage-tint px-2 py-[3px] text-[11px] text-sage">{children}</span>
  );
}

/**
 * 사진 위에 올리는 둥근 배지.
 * tone="paper"는 유형(방문형 등), tone="ink"는 D-day.
 */
export function Badge({ tone = 'paper', children }: { tone?: 'paper' | 'ink'; children: React.ReactNode }) {
  const toneClass = tone === 'ink' ? 'bg-ink text-paper' : 'bg-paper font-medium text-ink-2';
  return (
    <span className={`flex h-[22px] items-center rounded-full px-2 text-[11px] ${toneClass}`}>{children}</span>
  );
}

/**
 * 필터용 둥근 버튼. 선택되면 ink 배경.
 *
 * 보이는 알약은 36px 그대로 두고, 누를 수 있는 영역만 44px로 넓힌다
 * (-my-1로 위아래 4px씩 되돌려 줄 높이는 그대로다 — 디자인 기준 1번의 44px).
 */
export function Chip({
  selected = false, onClick, children, icon,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const toneClass = selected
    ? 'border-0 bg-ink text-paper font-medium'
    : 'border border-line bg-paper text-ink-2';
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected}
      className="-my-1 flex min-h-[44px] shrink-0 items-center"
    >
      <span className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${toneClass}`}>
        {icon}
        {children}
      </span>
    </button>
  );
}

/** 영문 머리말 + 제목 + 오른쪽 '전체보기' */
export function SectionHeader({
  eyebrow, title, moreHref, moreLabel = '전체보기',
}: {
  eyebrow?: string;
  title: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        {eyebrow && <span className="font-accent text-sm italic text-clay">{eyebrow}</span>}
        <h2 className="mt-0.5 font-serif text-section font-bold">{title}</h2>
      </div>
      {moreHref && (
        <Link href={moreHref} className="flex min-h-[44px] items-center text-[13px] text-muted">
          {moreLabel}
        </Link>
      )}
    </div>
  );
}

/** 밑줄 탭. 선택 항목은 ink 굵게 + 2px 밑줄 */
export function CategoryTabs({
  tabs, value, onChange, ariaLabel = '분류',
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="no-scrollbar flex gap-[22px] overflow-x-auto border-b border-line px-5">
      {tabs.map(t => {
        const on = t.value === value;
        return (
          <button
            key={t.value} type="button" onClick={() => onChange(t.value)}
            aria-current={on ? 'true' : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap py-3 text-sm ${
              on ? 'border-b-2 border-ink font-bold text-ink' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

/** clay-tint 안내 상자 */
export function NoticeBox({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <section className="rounded-card bg-clay-tint px-5 py-[18px]">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-clay-dark">{title}</h2>
      <ul className="list-disc pl-[18px] text-[13px] leading-[1.75] text-clay-dark">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </section>
  );
}
