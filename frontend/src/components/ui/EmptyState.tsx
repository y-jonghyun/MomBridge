import type { ReactNode } from 'react';
import { ArchIcon } from './icons';

/**
 * 출시 첫날처럼 보여 줄 것이 없을 때의 화면 (app-feel PR 8).
 * 한 줄 안내 대신 표지 그림 · 제목 · 설명 · 다음 행동을 함께 둬서 '앱이 멈춘 것 같은' 느낌을 없앤다.
 * 다음 행동(버튼)은 children으로 받는다.
 */
export default function EmptyState({
  icon, title, body, children, className = '', titleId,
}: {
  /** 표지 그림. 없으면 앱 아이콘의 두 아치 */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** 제목에 붙일 id (섹션의 aria-labelledby용) */
  titleId?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-card border border-line bg-paper px-5 pb-5 pt-6 text-center ${className}`}>
      <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-tint text-clay">
        {icon ?? <ArchIcon size={40} strokeWidth={1.7} />}
      </span>
      <h3 id={titleId} className="mt-3.5 break-keep font-serif text-[19px] font-bold leading-[1.4] text-ink">{title}</h3>
      {body && <p className="mt-2 break-keep text-[13.5px] leading-[1.6] text-ink-2">{body}</p>}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
