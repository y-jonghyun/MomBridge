'use client';
import { useState } from 'react';

interface Point { day: string; clicks: number; uniqueVisitors: number }

// 검증된 2색 (dataviz 기본 팔레트 1·2번, 흰 배경 기준 대비·색각 분리 통과)
const CLICK_COLOR = '#2a78d6';
const UNIQUE_COLOR = '#eb6834';

/** 일별 유입 추이: 총 클릭(막대) + 고유 방문자(선). 같은 단위라 축 하나 */
export default function DailyChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;

  const W = 640, H = 200, padL = 32, padR = 8, padT = 12, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(1, ...data.map(d => d.clicks));
  const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const step = innerW / data.length;
  const barW = Math.max(1, Math.min(18, step - 2));
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const x = (i: number) => padL + step * i + step / 2;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(data.length / 8);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.uniqueVisitors).toFixed(1)}`).join(' ');
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-ink-2 mb-2">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CLICK_COLOR }} />총 클릭</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: UNIQUE_COLOR }} />고유 방문자</span>
        <span className="ml-auto text-ink-2 tabular-nums min-h-[1rem]">
          {h ? `${h.day} · 클릭 ${h.clicks} · 고유 ${h.uniqueVisitors}` : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="일별 유입 추이" onMouseLeave={() => setHover(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#52514e">{t}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const top = y(d.clicks);
            const height = padT + innerH - top;
            return (
              <g key={d.day}>
                {height > 0 && (
                  <path
                    d={`M${x(i) - barW / 2},${padT + innerH} V${top + Math.min(4, height)} Q${x(i) - barW / 2},${top} ${x(i) - barW / 2 + Math.min(4, barW / 2)},${top} H${x(i) + barW / 2 - Math.min(4, barW / 2)} Q${x(i) + barW / 2},${top} ${x(i) + barW / 2},${top + Math.min(4, height)} V${padT + innerH} Z`}
                    fill={CLICK_COLOR}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#52514e">{d.day.slice(5)}</text>
                )}
                {/* 막대보다 넓은 호버 영역 */}
                <rect x={padL + step * i} y={padT} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
          <path d={line} fill="none" stroke={UNIQUE_COLOR} strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
          {h && hover !== null && (
            <circle cx={x(hover)} cy={y(h.uniqueVisitors)} r={4} fill={UNIQUE_COLOR} stroke="#fff" strokeWidth={2} pointerEvents="none" />
          )}
        </svg>
      </div>
    </div>
  );
}
