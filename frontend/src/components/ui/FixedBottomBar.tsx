'use client';
import { useRef } from 'react';
import { BOTTOM_BAR_VAR, useReportHeight } from '@/lib/bottom-chrome';

/**
 * 화면 아래에 고정된 버튼 막대 (미션 상세의 신청 버튼, 고객사의 "새 미션 등록" 등).
 * 자기 높이를 --mb-bottom-bar로 알려, 설치 배너·안내 문구가 이 막대를 가리지 않고 그 위에 뜨게 한다.
 */
export default function FixedBottomBar({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useReportHeight(ref, BOTTOM_BAR_VAR);
  return (
    <div
      ref={ref}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] ${className}`}
    >
      {children}
    </div>
  );
}
