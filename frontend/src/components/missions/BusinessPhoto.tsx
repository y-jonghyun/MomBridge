import { photoTone } from '@/components/ui/MissionCard';
import {
  BeautyIcon, CafeIcon, FoodIcon, KidsIcon, LivingIcon, ShopIcon,
} from '@/components/ui/icons';

/**
 * 사진이 없는 미션의 자리 그림.
 * 업종을 골랐으면 그 업종 그림을, 아니면 가게 그림을 쓴다.
 * 바탕색은 미션 id로 고르므로 다시 그려도 같은 색이 나온다.
 */
const ART: Record<string, { Icon: typeof FoodIcon; label: string }> = {
  FOOD: { Icon: FoodIcon, label: '맛집' },
  CAFE: { Icon: CafeIcon, label: '카페' },
  KIDS: { Icon: KidsIcon, label: '키즈' },
  BEAUTY: { Icon: BeautyIcon, label: '뷰티' },
  LIVING: { Icon: LivingIcon, label: '생활' },
};
const FALLBACK = { Icon: ShopIcon, label: '가게 사진' };

export default function BusinessPhoto({
  missionId, businessCategory, size = 'md',
}: {
  missionId: string;
  businessCategory?: string | null;
  /** sm: 64px 썸네일(글자 없음) · md: 카드 · lg: 상세 340px */
  size?: 'sm' | 'md' | 'lg';
}) {
  const tone = photoTone(missionId);
  const { Icon, label } = ART[businessCategory ?? ''] ?? FALLBACK;
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 56 : 36;

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 ${tone.bg} ${tone.fg}`}>
      <Icon size={iconSize} strokeWidth={1.3} />
      {size !== 'sm' && (
        <span className={`text-[11px] tracking-[0.04em] ${size === 'lg' ? 'text-[13px]' : ''}`}>{label}</span>
      )}
    </div>
  );
}
