'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import RegisterMissionForm, {
  type ClientOption, type FieldRule, type RegisterForm,
} from '@/components/operator/RegisterMissionForm';
import { normalizeProvince } from '@/lib/regions';
import { missionDateError } from '@/lib/mission-dates';
import { useAuthStore } from '@/store/auth';

/**
 * 미션 수정 — 등록 폼을 그대로 다시 쓰고, 칸마다 서버가 내려준 잠금 규칙을 입힌다.
 * 운영자 미션 관리와 고객사 '내 미션'이 같은 이 창을 쓴다.
 */

const asDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');

/** 체험단원에게 불리한 변경(줄이기·앞당기기). 운영자만 여기까지 올 수 있다 */
const UNFAVORABLE_LABEL: Partial<Record<keyof RegisterForm, string>> = {
  rewardAmount: '보상 금액', maxParticipants: '모집 인원',
  endDate: '신청 마감일', announceDate: '선정 발표일', submissionDeadline: '후기 마감일',
};

function unfavorableChanges(before: RegisterForm, after: RegisterForm): string[] {
  const out: string[] = [];
  if (Number(after.rewardAmount || 0) < Number(before.rewardAmount || 0)) out.push(`${UNFAVORABLE_LABEL.rewardAmount} 줄이기`);
  if (Number(after.maxParticipants || 0) < Number(before.maxParticipants || 0)) out.push(`${UNFAVORABLE_LABEL.maxParticipants} 줄이기`);
  for (const field of ['endDate', 'announceDate', 'submissionDeadline'] as const) {
    const was = before[field], now = after[field];
    if (!was) continue;                       // 비어 있던 일정을 채우는 건 불리하지 않다
    if (!now) out.push(`${UNFAVORABLE_LABEL[field]} 지우기`);
    else if (now < was) out.push(`${UNFAVORABLE_LABEL[field]} 앞당기기`);   // YYYY-MM-DD는 글자 비교로 충분
  }
  return out;
}

export default function MissionEditModal({ missionId, onClose, onSaved }: {
  missionId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const role = useAuthStore(st => st.user?.role);
  const [form, setForm] = useState<RegisterForm | null>(null);
  /** 불러온 그대로의 값 — 무엇이 불리하게 바뀌었는지 견준다 */
  const [initial, setInitial] = useState<RegisterForm | null>(null);
  /** 저장 전에 묻는 중인 불리한 변경 목록 */
  const [asking, setAsking] = useState<string[] | null>(null);
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
      setAsking(null);
      const loaded: RegisterForm = {
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
      };
      setForm(loaded);
      setInitial(loaded);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? '미션을 불러오지 못했어요');
    }
  }, [missionId]);

  useEffect(() => { void load(); }, [load]);

  const set = (key: keyof RegisterForm, value: string | string[] | boolean) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setDone('');

    const dateError = missionDateError(form);
    if (dateError) { setError(dateError); return; }

    // 신청이 들어온 미션에서 불리하게 바꾸는 건 운영자만 할 수 있다. 저장 전에 한 번 묻는다
    const bad = role === 'OPERATOR' && applicationCount > 0 && initial
      ? unfavorableChanges(initial, form)
      : [];
    if (bad.length > 0) { setAsking(bad); return; }

    void doSave(false);
  }

  async function doSave(acknowledged: boolean) {
    if (!form) return;
    setAsking(null);
    setError('');
    setDone('');
    setSaving(true);
    try {
      const { data } = await api.put(`/missions/${missionId}/edit`, {
        ...form,
        rewardAmount: Number(form.rewardAmount),
        maxParticipants: Number(form.maxParticipants),
        // 불리한 변경을 확인하고 보냈다는 표시 (기록에 남는다)
        ...(acknowledged ? { acknowledgeUnfavorable: true } : {}),
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
            {asking && (
              <div className="mt-3 rounded-card border border-clay-dark bg-clay-tint/40 p-4">
                <p className="break-keep text-sm font-semibold text-clay-dark">
                  지원·선정된 {applicationCount}명에게 불리한 변경이에요. 계속할까요?
                </p>
                <ul className="mt-2 space-y-0.5 text-[13px] leading-[1.6] text-ink-2">
                  {asking.map(item => <li key={item}>· {item}</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted">계속하면 누가 확인하고 바꿨는지 기록에 남습니다.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void doSave(true)} disabled={saving}
                    className="h-11 flex-1 rounded-control bg-clay-dark text-sm font-semibold text-paper disabled:opacity-50">
                    예, 계속할게요
                  </button>
                  <button type="button" onClick={() => setAsking(null)}
                    className="h-11 flex-1 rounded-control border border-line bg-paper text-sm text-ink-2">
                    아니요
                  </button>
                </div>
              </div>
            )}
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
