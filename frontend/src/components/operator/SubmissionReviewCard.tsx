'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { SubmissionCheckPanel } from './OperatorCampaignTools';
import { DangerButton, PrimaryButton, QuietButton, ShortDate, StatusBadge } from './ui';

/**
 * 콘텐츠 검수 카드.
 * 대가 표시 확인 결과 · 추적 링크 방문 수 · 제출 사진 미리보기를 한자리에서 보고,
 * 반려·수정 요청에는 사유를 반드시 받는다.
 */

type Decision = 'REJECTED' | 'REVISION';

const DISCLOSURE: Record<string, { text: string; tone: string }> = {
  AUTO_PASSED: { text: '대가 표시 자동 확인', tone: 'bg-sage-tint text-sage' },
  MANUAL_CONFIRMED: { text: '대가 표시 운영자 확인', tone: 'bg-sage-tint text-sage' },
  NEEDS_MANUAL_REVIEW: { text: '대가 표시 수동 확인 필요', tone: 'bg-clay-tint text-clay-dark' },
  NOT_FOUND: { text: '대가 표시 못 찾음', tone: 'bg-clay-tint text-clay-dark' },
  // 블로그(리뷰) 캠페인만 자동으로 확인한다. 그 밖의 유형은 운영자가 직접 보고 체크한다
  SELF_CHECK: { text: '대가 표시 확인 전', tone: 'bg-clay-tint text-clay-dark' },
};

/**
 * 자동 확인 대상이 아닌 유형의 대가 표시 확인.
 * 체크하면 누가 언제 확인했는지가 기록에 남고(AuditLog), 그 뒤에야 승인할 수 있다.
 */
function SelfCheck({ submission, onConfirmed }: {
  submission: Record<string, any>;
  onConfirmed: (updated: Record<string, any>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const done = submission.disclosureCheck === 'MANUAL_CONFIRMED';

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/submissions/${submission.id}/disclosure-confirm`, {});
      onConfirmed(data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? '확인 처리를 하지 못했어요');
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <div className="mb-3 rounded-control border border-sage-tint bg-sage-tint p-3 text-sm">
        <p className="font-medium text-sage">대가 표시 운영자 확인</p>
        <p className="mt-1 text-xs text-ink-2">
          {submission.disclosureConfirmedBy?.user?.name ?? '운영자'}
          {submission.disclosureConfirmedAt && ` · ${new Date(submission.disclosureConfirmedAt).toLocaleString('ko-KR')}`}
          {submission.disclosureConfirmNote && ` · ${submission.disclosureConfirmNote}`}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-control border border-clay-tint bg-clay-tint p-3 text-sm">
      <label className="flex items-start gap-2 break-keep text-clay-dark">
        <input
          type="checkbox" checked={false} disabled={saving}
          onChange={() => void confirm()}
          className="mt-0.5 h-4 w-4 shrink-0 accent-clay-dark"
        />
        <span>
          <b className="font-medium">대가 표시를 직접 확인했어요</b>
          <span className="mt-0.5 block text-xs text-ink-2">
            게시글에 대가 표시(예: 제품·서비스 제공받아 작성)가 있는지 보고 체크해 주세요.
            체크 전에는 승인할 수 없습니다.
          </span>
        </span>
      </label>
      {error && <p className="mt-1.5 text-[13px] text-clay-dark">{error}</p>}
    </div>
  );
}

export default function SubmissionReviewCard({ submission, onChange, onReview, busy }: {
  submission: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
  onReview: (id: string, status: 'APPROVED' | Decision, reason?: string) => void;
  /** 처리 중이면 버튼을 막는다 (두 번 눌러 중복 처리되는 것을 막는다) */
  busy?: boolean;
}) {
  const s = submission;
  const [asking, setAsking] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // 대가 표시가 확인돼야 승인할 수 있다 (서버도 같은 규칙으로 막는다).
  // 자동 확인은 블로그(리뷰) 캠페인만 돌고, 그 밖의 유형은 운영자가 직접 확인에 체크한다.
  const autoChecked = s.mission?.category === 'REVIEW';
  const confirmed = ['AUTO_PASSED', 'MANUAL_CONFIRMED'].includes(s.disclosureCheck);
  const disclosure = confirmed
    ? DISCLOSURE[s.disclosureCheck]
    : (autoChecked ? (DISCLOSURE[s.disclosureCheck] ?? DISCLOSURE.NEEDS_MANUAL_REVIEW) : DISCLOSURE.SELF_CHECK);
  const blocked = !confirmed;
  const photos: string[] = s.mediaUrls ?? [];
  const traffic = s.traffic ?? { clicks: 0, uniqueVisitors: 0 };

  function submitDecision() {
    if (!reason.trim()) {
      setError(asking === 'REJECTED' ? '반려 사유를 적어 주세요' : '무엇을 고쳐야 하는지 적어 주세요');
      return;
    }
    onReview(s.id, asking!, reason.trim());
    setAsking(null);
    setReason('');
    setError('');
  }

  return (
    <div className="rounded-box bg-paper p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{s.mission?.title}</p>
          <p className="text-sm text-muted">{s.participant?.user?.name} ({s.participant?.user?.email})</p>
        </div>
        <span className="shrink-0 text-xs text-muted"><ShortDate value={s.submittedAt} /></span>
      </div>

      {/* 확인 결과 · 방문 수 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge className={disclosure.tone}>{disclosure.text}</StatusBadge>
        <StatusBadge>방문 {traffic.clicks}회</StatusBadge>
        <StatusBadge>고유 방문자 {traffic.uniqueVisitors}명</StatusBadge>
      </div>

      {s.description && <p className="mb-3 rounded-control bg-cream p-3 text-sm text-ink-2">{s.description}</p>}

      {s.snsPostUrl && (
        <a href={s.snsPostUrl} target="_blank" rel="noreferrer"
          className="mb-3 block text-xs text-clay underline">게시글 보기 →</a>
      )}

      {/* 블로그(리뷰) 캠페인은 자동 확인 결과를, 그 밖의 유형은 직접 확인 체크를 보여 준다 */}
      {autoChecked
        ? <SubmissionCheckPanel submission={s} onConfirmed={onChange} />
        : <SelfCheck submission={s} onConfirmed={onChange} />}

      {/* 제출 사진 미리보기 */}
      {photos.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs text-muted">제출 사진 {photos.length}장</p>
          <ul className="flex flex-wrap gap-2">
            {photos.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noreferrer" title={`제출 사진 ${i + 1} 원본 보기`}>
                  {/* 외부 주소라 next/image 대신 img를 쓴다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`제출 사진 ${i + 1}`}
                    className="h-20 w-20 rounded-photo border border-line object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 반려·수정 요청 사유 */}
      {asking ? (
        <div className="rounded-card border border-clay-tint bg-clay-tint/40 p-3">
          <label htmlFor={`reason-${s.id}`} className="mb-1 block text-[13px] font-medium text-clay-dark">
            {asking === 'REJECTED' ? '반려 사유 (체험단원에게 보입니다)' : '고쳐야 할 점 (체험단원에게 보입니다)'}
          </label>
          <textarea id={`reason-${s.id}`} rows={2} value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}
            placeholder={asking === 'REJECTED' ? '예: 대가 표시 문구가 없습니다' : '예: 글 맨 위에 대가 표시 문구를 넣어 주세요'}
            className="w-full resize-none rounded-control border border-line bg-paper p-2.5 text-sm outline-none focus:border-ink" />
          {error && <p className="mt-1 text-[13px] text-clay-dark">{error}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PrimaryButton tone="clay" busy={busy} onClick={submitDecision}>
              {asking === 'REJECTED' ? '반려하기' : '수정 요청 보내기'}
            </PrimaryButton>
            <QuietButton onClick={() => { setAsking(null); setReason(''); setError(''); }}>취소</QuietButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton
            onClick={() => onReview(s.id, 'APPROVED')}
            disabled={blocked}
            busy={busy}
            title={blocked ? '대가 표시를 확인한 뒤 승인할 수 있습니다' : undefined}
          >
            승인 (정산 생성)
          </PrimaryButton>
          <QuietButton busy={busy} onClick={() => setAsking('REVISION')}>수정 요청</QuietButton>
          <DangerButton busy={busy} confirmLabel="사유를 적는 칸이 열려요" onConfirm={() => setAsking('REJECTED')}>반려</DangerButton>
        </div>
      )}
    </div>
  );
}
