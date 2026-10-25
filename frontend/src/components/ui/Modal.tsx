'use client';
import { useEffect } from 'react';

/**
 * 가운데 뜨는 창. Esc와 바깥(어두운 곳) 클릭으로 닫힌다.
 * 열려 있는 동안은 뒤 화면이 스크롤되지 않는다.
 */
export default function Modal({
  onClose, children, labelledBy, className = 'max-w-lg',
}: {
  onClose: () => void;
  children: React.ReactNode;
  /** 창 제목 요소의 id (읽어 주는 이름) */
  labelledBy?: string;
  /** 창 너비 */
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4"
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      // 어두운 곳을 눌렀을 때만 닫는다 (창 안을 눌렀을 때는 닫히지 않게)
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`my-auto w-full rounded-box bg-paper p-5 ${className}`}>{children}</div>
    </div>
  );
}
