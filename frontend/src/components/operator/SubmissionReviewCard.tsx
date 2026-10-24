'use client';
import { useState } from 'react';
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
  NOT_FOUND: { text: '대가 표시 못 찾음', tone: 'bg-clay-tint text-clay-dark' },
  PENDING: { text: '대가 표시 확인 전', tone: 'bg-cream text-ink-2' },
};

export default function SubmissionReviewCard({ submission, onChange, onReview }: {
  submission: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
  onReview: (id: string, status: 'APPROVED' | Decision, reason?: string) => void;
}) {
  const s = submission;
  const [asking, setAsking] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const disclosure = DISCLOSURE[s.disclosureCheck] ?? DISCLOSURE.PENDING;
  const blocked = s.mission?.category === 'REVIEW'
    && !['AUTO_PASSED', 'MANUAL_CONFIRMED'].includes(s.disclosureCheck);
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

      <SubmissionCheckPanel submission={s} onConfirmed={onChange} />

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
            <PrimaryButton tone="clay" onClick={submitDecision}>
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
            title={blocked ? '대가 표시 확인 후 승인할 수 있습니다' : undefined}
          >
            승인 (정산 생성)
          </PrimaryButton>
          <QuietButton onClick={() => setAsking('REVISION')}>수정 요청</QuietButton>
          <DangerButton confirmLabel="사유를 적는 칸이 열려요" onConfirm={() => setAsking('REJECTED')}>반려</DangerButton>
        </div>
      )}
    </div>
  );
}
