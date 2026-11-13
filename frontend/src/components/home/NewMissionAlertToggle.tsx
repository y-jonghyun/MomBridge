'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { BellIcon } from '@/components/ui/icons';

/**
 * 새 미션 알림 받기 — 활동 지역(구)에 미션이 열리면 앱 안 알림함으로 알린다.
 * 휴대폰 푸시·문자는 보내지 않는다 (1단계는 알림함만).
 * 꺼져 있으면 권하는 카드, 켜져 있으면 한 줄 + '끄기'.
 */
export default function NewMissionAlertToggle({ gu, on, onChange, className = '' }: {
  gu: string;
  on: boolean;
  onChange: (on: boolean) => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(next: boolean) {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/participant/profile/alerts', { newMissionAlerts: next });
      onChange(!!data.data.newMissionAlerts);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    } finally { setSaving(false); }
  }

  if (on) {
    return (
      <div className={className}>
        <p className="flex items-center justify-between gap-3 text-[13px] text-muted">
          <span className="flex min-w-0 items-center gap-1.5 break-keep">
            <BellIcon size={14} strokeWidth={1.8} className="shrink-0 text-clay" />
            {gu}에 새 미션이 열리면 알림함으로 알려 드려요
          </span>
          <button
            type="button" disabled={saving} onClick={() => save(false)}
            className="flex min-h-[44px] shrink-0 items-center px-1 text-[13px] text-ink-2 underline underline-offset-2 disabled:opacity-50"
          >
            알림 끄기
          </button>
        </p>
        {error && <p role="alert" className="text-[13px] text-clay-dark">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-card border border-line bg-paper px-4 py-4 ${className}`}>
      <p className="break-keep text-sm font-medium text-ink">{gu}에 새 미션이 열리면 알려 드릴까요?</p>
      <p className="mt-1 break-keep text-[13px] leading-[1.6] text-muted">
        앱 안 알림함(종 모양)으로 알려 드려요. 언제든 끌 수 있어요.
      </p>
      <button
        type="button" disabled={saving} onClick={() => save(true)}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-control bg-clay text-sm font-bold text-paper disabled:opacity-50"
      >
        <BellIcon size={16} strokeWidth={1.8} />
        {saving ? '저장 중…' : '새 미션 알림 받기'}
      </button>
      {error && <p role="alert" className="mt-2 text-[13px] text-clay-dark">{error}</p>}
    </div>
  );
}
