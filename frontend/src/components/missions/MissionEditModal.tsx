'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import RegisterMissionForm, {
  type ClientOption, type FieldRule, type RegisterForm,
} from '@/components/operator/RegisterMissionForm';
import { normalizeProvince } from '@/lib/regions';
import { missionDateError } from '@/lib/mission-dates';

/**
 * 미션 수정 — 등록 폼을 그대로 다시 쓰고, 칸마다 서버가 내려준 잠금 규칙을 입힌다.
 * 운영자 미션 관리와 고객사 '내 미션'이 같은 이 창을 쓴다.
 */

const asDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');

export default function MissionEditModal({ missionId, onClose, onSaved }: {
  missionId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<RegisterForm | null>(null);
  const [rules, setRules] = useState<Record<string, FieldRule>>({});
  const [client, setClient] = useState<ClientOption | null>(null);
  const [applicationCount, setApplicationCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get(`/missions/${missionId}/edit`);
      const m = data.data.mission;
      setRules(data.data.rules);
      setApplicationCount(data.data.applicationCount);
      setClient({ id: m.clientProfileId, businessName: m.businessName });
      setForm({
        clientProfileId: m.clientProfileId,
        title: m.title ?? '',
        description: m.description ?? '',
        category: m.category ?? 'SNS',
        rewardAmount: m.rewardAmount != null ? String(Number(m.rewardAmount)) : '',
        maxParticipants: m.maxParticipants != null ? String(m.maxParticipants) : '',
        regionSi: normalizeProvince(m.regionSi ?? ''),
        regionGu: m.regionGu ?? '',
        regionDong: m.regionDong ?? '',
        visitAddress: m.visitAddress ?? '',
        startDate: asDate(m.startDate),
        endDate: asDate(m.endDate),
        announceDate: asDate(m.announceDate),
        submissionDeadline: asDate(m.submissionDeadline),
        requirements: m.requirements ?? '',
        visitGuide: m.visitGuide ?? '',
        businessCategory: m.businessCategory ?? '',
        momTags: m.momTags ?? [],
        visitHours: m.visitHours ?? '',
        sendPaymentLink: false,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? '미션을 불러오지 못했어요');
    }
  }, [missionId]);

  useEffect(() => { void load(); }, [load]);

  const set = (key: keyof RegisterForm, value: string | string[] | boolean) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setDone('');

    const dateError = missionDateError(form);
    if (dateError) { setError(dateError); return; }

    setSaving(true);
    try {
      const { data } = await api.put(`/missions/${missionId}/edit`, {
        ...form,
        rewardAmount: Number(form.rewardAmount),
        maxParticipants: Number(form.maxParticipants),
      });
      const changed: string[] = data.data.changed ?? [];
      const notified: number = data.data.notified ?? 0;
      setDone(
        changed.length === 0
          ? '바뀐 내용이 없어요'
          : `${changed.length}곳을 저장했어요${notified > 0 ? ` · 선정된 ${notified}명에게 알렸어요` : ''}`,
      );
      await load();
      onSaved?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? '저장하지 못했어요');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-3xl rounded-box bg-paper p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-accent text-sm italic text-clay">Edit</span>
            <h2 className="font-serif text-section font-bold text-ink">미션 수정</h2>
            {applicationCount > 0 && (
              <p className="mt-1 break-keep text-[13px] leading-[1.6] text-clay-dark">
                이미 {applicationCount}명이 신청했어요. 신청한 분들에게 불리한 변경은 잠겨 있어요.
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="닫기" className="shrink-0 text-xl text-muted">×</button>
        </div>

        {error && <p className="mb-3 rounded-card border border-clay-tint bg-clay-tint/40 px-4 py-2 text-sm text-clay-dark">{error}</p>}
        {done && <p className="mb-3 rounded-card border border-line bg-cream px-4 py-2 text-sm text-ink-2">{done}</p>}

        {form ? (
          <>
            <RegisterMissionForm
              mode="edit"
              rules={rules}
              missionId={missionId}
              form={form}
              set={set}
              clients={client ? [client] : []}
              pendingImages={[]}
              onPendingChange={() => {}}
              submitting={saving}
              onSubmit={save}
              submitLabel="수정 내용 저장"
            />
            <button type="button" onClick={onClose}
              className="mt-3 h-11 w-full rounded-control border border-line bg-paper text-sm text-ink-2">
              닫기
            </button>
          </>
        ) : (
          !error && <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
        )}
      </div>
    </div>
  );
}
