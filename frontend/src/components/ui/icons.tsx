/**
 * 시안에 쓰인 선 아이콘. 굵기 1.5~1.8, 이모지는 쓰지 않는다.
 * 색은 currentColor를 따르므로 감싸는 요소의 text-* 로 정한다.
 */
type IconProps = { size?: number; strokeWidth?: number; className?: string };

function Svg({ size = 22, strokeWidth = 1.6, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>
);
export const BellIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5h4" /></Svg>
);
export const PinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.2" /></Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 11l8-6 8 6v8.5H4z" /></Svg>
);
export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);
export const ChatIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 5h14v10H9l-4 4z" /></Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></Svg>
);
export const HeartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16v.5" /></Svg>
);
export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15 16l4-4-4-4" /><path d="M19 12H9" /><path d="M9 5H5v14h4" /></Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);
export const ShareIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" /></Svg>
);
export const CameraIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="6.5" width="17" height="12" rx="2" /><circle cx="12" cy="12.5" r="3.2" /><path d="M9 6.5l1.2-2h3.6l1.2 2" /></Svg>
);
export const DocIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 4h10l4 4v12H5z" /><path d="M8 11h8M8 14.5h8M8 18h5" /></Svg>
);
export const KeywordIcon = (p: IconProps) => (
  <Svg {...p}><path d="M7 4v16M4 8h16M4 16h16M17 4v16" /></Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.5 6.3" /><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3" /></Svg>
);

// ── 업종별 자리 그림 ──
// 사진이 없는 미션의 자리를 채우는 그림. 선 아이콘과 같은 결을 쓰되 크게 그린다.
export const FoodIcon = (p: IconProps) => (
  <Svg {...p}><path d="M7 3v8a2.5 2.5 0 0 0 5 0V3" /><path d="M9.5 11v10" /><path d="M17 3c-1.5 1.5-2 3.5-2 5.5S16 12 17 12v9" /></Svg>
);
export const CafeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 9h12v5a5 5 0 0 1-10 0z" /><path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16" /><path d="M5 21h12" /><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5" /></Svg>
);
export const KidsIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><path d="M8.5 5.5 6 3M15.5 5.5 18 3" /></Svg>
);
export const BeautyIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 3h6l-1 6H10z" /><path d="M8.5 9h7l.5 11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" /><path d="M8.7 14h6.6" /></Svg>
);
export const LivingIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-5.5h4V20" /></Svg>
);
export const ShopIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 11v9h14v-9" /><path d="M10 20v-5h4v5" /></Svg>
);
