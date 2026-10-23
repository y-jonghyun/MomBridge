'use client';
import { useRef, useState } from 'react';
import BusinessPhoto from './BusinessPhoto';

export interface MissionPhoto { id: string; url: string }

/**
 * 미션 상세 맨 위 사진. 여러 장이면 옆으로 넘기고 '1 / n'을 보여준다.
 * 사진이 없으면 업종 자리 그림을 그린다.
 */
export default function MissionGallery({
  missionId, businessCategory, images, children,
}: {
  missionId: string;
  businessCategory?: string | null;
  images: MissionPhoto[];
  /** 사진 위에 얹는 버튼들 (뒤로·공유) */
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="relative h-[340px] overflow-hidden">
        <BusinessPhoto missionId={missionId} businessCategory={businessCategory} size="lg" />
        {children}
      </div>
    );
  }

  /** 스크롤이 멈춘 자리로 현재 장을 정한다 (점·숫자 표시용) */
  function onScroll() {
    const el = railRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) setIndex(Math.min(Math.max(next, 0), images.length - 1));
  }

  function go(to: number) {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative h-[340px] overflow-hidden">
      <div
        ref={railRef} onScroll={onScroll}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((img, i) => (
          // 업로드 직후 주소라 next/image 대신 img를 쓴다
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id} src={img.url} alt={`미션 사진 ${i + 1}`}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper">
            {index + 1} / {images.length}
          </span>
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {images.map((img, i) => (
              <button
                key={img.id} type="button" aria-label={`${i + 1}번째 사진 보기`}
                aria-current={i === index} onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-paper' : 'w-1.5 bg-paper/60'}`}
              />
            ))}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
