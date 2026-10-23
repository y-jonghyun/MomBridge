import Link from 'next/link';
import { Badge, Tag } from './primitives';

/** 사진이 없을 때 쓰는 자리 색. 미션 id로 고정 선택해 다시 그려도 같은 색이 나온다 */
const PHOTO_TONES = [
  { bg: 'bg-photo-1', fg: 'text-photo-ink-1' },
  { bg: 'bg-photo-2', fg: 'text-photo-ink-2' },
  { bg: 'bg-photo-3', fg: 'text-photo-ink-3' },
  { bg: 'bg-photo-4', fg: 'text-photo-ink-4' },
];
export function photoTone(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % PHOTO_TONES.length;
  return PHOTO_TONES[sum];
}

export interface MissionCardData {
  id: string;
  /** [동] 가게 이름 — 동이 없으면 구 이름 */
  place: string;
  /** 제공 내용 */
  offer?: string | null;
  rewardAmount: number;
  /** 수수료 공제 후 실수령. 서버 계산값이 있으면 그 값 */
  netAmount?: number | null;
  categoryLabel?: string | null;
  /** D-3 이하일 때만 넘긴다 */
  dday?: number | null;
  /** 엄마 시간 태그. 데이터가 생기기 전까지는 비워 둔다 */
  tags?: string[];
  thumbnailUrl?: string | null;
  appliedCount?: number | null;
  maxParticipants?: number | null;
}

const won = (n: number) => `${Number(n).toLocaleString()}원`;

function Photo({ m, rounded, size, compact = false }: {
  m: MissionCardData; rounded: string; size: string;
  /** 64px 썸네일처럼 배지를 올릴 자리가 없는 경우 (시안의 row 카드) */
  compact?: boolean;
}) {
  const tone = photoTone(m.id);
  return (
    <div className={`relative ${size} ${rounded} ${m.thumbnailUrl ? '' : tone.bg} flex items-center justify-center overflow-hidden`}>
      {m.thumbnailUrl
        // 외부 이미지 도메인이 정해지기 전까지 next/image 대신 img를 쓴다
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        : !compact && <span className={`text-[11px] tracking-[0.04em] ${tone.fg}`}>가게 사진</span>}
      {!compact && m.categoryLabel && (
        <span className="absolute left-2 top-2"><Badge>{m.categoryLabel}</Badge></span>
      )}
      {!compact && typeof m.dday === 'number' && m.dday >= 0 && m.dday <= 3 && (
        <span className="absolute bottom-2 right-2"><Badge tone="ink">{m.dday === 0 ? 'D-Day' : `D-${m.dday}`}</Badge></span>
      )}
    </div>
  );
}

/**
 * 미션 카드.
 * - grid: 목록 2열
 * - rail: 홈 가로 스크롤(폭 236px)
 * - row: 64px 썸네일 한 줄
 */
export default function MissionCard({
  mission, variant = 'grid', href,
}: {
  mission: MissionCardData;
  variant?: 'grid' | 'rail' | 'row';
  href?: string;
}) {
  const m = mission;
  const to = href ?? `/missions/${m.id}`;
  const applied = m.appliedCount ?? null;
  const max = m.maxParticipants ?? null;

  if (variant === 'row') {
    return (
      <Link href={to} className="flex items-center gap-3.5 border-t border-line-soft py-3 text-ink">
        <Photo m={m} rounded="rounded-control" size="h-16 w-16 shrink-0" compact />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{m.place}</p>
          <p className="mt-[3px] truncate text-xs text-muted">
            {[m.offer, applied !== null && max !== null ? `신청 ${applied} / 모집 ${max}` : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-clay">{won(m.rewardAmount)}</span>
      </Link>
    );
  }

  if (variant === 'rail') {
    return (
      <Link href={to} className="flex w-[236px] shrink-0 flex-col text-ink">
        <Photo m={m} rounded="rounded-card" size="h-[236px] w-full" />
        {m.tags && m.tags.length > 0 && (
          <div className="mt-3 flex gap-1.5">{m.tags.map(t => <Tag key={t}>{t}</Tag>)}</div>
        )}
        <p className="mb-0.5 mt-2 line-clamp-2 text-[15px] font-medium tracking-[-0.01em]">{m.place}</p>
        {m.offer && <p className="line-clamp-1 text-[13px] text-muted">{m.offer}</p>}
        <p className="mt-2 text-[15px] font-bold text-clay">
          {won(m.rewardAmount)}
          {m.netAmount != null && (
            <span className="ml-1 text-xs font-normal text-muted">실수령 {won(m.netAmount)}</span>
          )}
        </p>
      </Link>
    );
  }

  return (
    <Link href={to} className="flex flex-col text-ink">
      <Photo m={m} rounded="rounded-photo" size="aspect-square w-full" />
      {m.tags && m.tags.length > 0 && (
        <p className="mt-2.5 text-[11px] text-sage">{m.tags.join(' · ')}</p>
      )}
      <p className="mt-[3px] line-clamp-2 text-sm font-medium leading-[1.4]">{m.place}</p>
      {m.offer && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{m.offer}</p>}
      <p className="mt-1.5 text-sm font-bold text-clay">{won(m.rewardAmount)}</p>
      {applied !== null && max !== null && (
        <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] text-muted">
          신청 {applied} / 모집 {max}
        </p>
      )}
    </Link>
  );
}
