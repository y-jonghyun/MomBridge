import Link from 'next/link';

/**
 * 미션 목록의 끝·빈 상태를 알리는 점선 상자.
 * /missions와 홈이 같은 문구·모양을 쓰도록 한곳에 둔다.
 */
export default function MissionEmptyBox({
  message, actionLabel, actionHref, onAction,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-photo border border-dashed border-[#D8CBB8] bg-paper p-4 text-[13px] leading-[1.6] text-ink-2">
      {message}
      {actionLabel && actionHref && (
        /* 글 안에 있는 링크라 세로 패딩으로만 누를 영역을 넓힌다 (줄 높이는 그대로다) */
        <Link href={actionHref} className="ml-1 py-3.5 font-medium text-clay underline-offset-2 hover:underline">
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button type="button" onClick={onAction} className="ml-1 py-3.5 font-medium text-clay underline-offset-2 hover:underline">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
