'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { KeywordBox, NoticeBox, ScheduleTimeline, StickyCTA, Tag, type ScheduleStep } from '@/components/ui';
import { CameraIcon, ChevronLeftIcon, DocIcon, KeywordIcon, LinkIcon, PinIcon, ShareIcon } from '@/components/ui/icons';
import MissionGallery from '@/components/missions/MissionGallery';
import { BUSINESS_LABEL, MOM_TAG_LABEL } from '@/components/missions/MissionBrowser';
import { useBookmarks } from '@/lib/bookmarks';
import { toLines } from '@/lib/lines';
import { payoutLabel } from '@/lib/payout';

/** 기준: docs/design/mombridge-design/cream-editorial-v1.md 3번 '미션 상세' + Detail.html */

const CATEGORY_LABEL: Record<string, string> = { VISIT: '방문형', SNS: 'SNS', REVIEW: '리뷰작성', VIDEO: '영상제작' };

/** 미션 내용 4칸. 유형별로 무엇을 해야 하는지 (아이콘은 선 아이콘, 이모지 없음) */
const MISSION_POINTS: Record<string, { Icon: typeof CameraIcon; label: string }[]> = {
  SNS: [
    { Icon: CameraIcon, label: '사진 첨부' }, { Icon: DocIcon, label: '해시태그' },
    { Icon: LinkIcon, label: 'URL 제출' }, { Icon: KeywordIcon, label: '키워드' },
  ],
  VISIT: [
    { Icon: PinIcon, label: '지도 첨부' }, { Icon: CameraIcon, label: '방문 사진' },
    { Icon: DocIcon, label: '후기 작성' }, { Icon: KeywordIcon, label: '키워드' },
  ],
  REVIEW: [
    { Icon: DocIcon, label: '리뷰 작성' }, { Icon: CameraIcon, label: '사진 첨부' },
    { Icon: LinkIcon, label: '링크 제출' }, { Icon: KeywordIcon, label: '키워드' },
  ],
  VIDEO: [
    { Icon: CameraIcon, label: '영상 제작' }, { Icon: DocIcon, label: '설명 첨부' },
    { Icon: LinkIcon, label: 'URL 제출' }, { Icon: KeywordIcon, label: '키워드' },
  ],
};

const won = (n: number) => `${Number(n).toLocaleString()}원`;
const day = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\.$/, '');

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 px-5">
      <span className="font-accent text-sm italic text-clay">{eyebrow}</span>
      <h2 className="mb-3 mt-0.5 font-serif text-section-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const savedIds = useBookmarks(s => s.ids);
  const loadBookmarks = useBookmarks(s => s.load);
  const toggleBookmark = useBookmarks(s => s.toggle);
  const canSave = user?.role === 'PARTICIPANT';

  useEffect(() => {
    api.get(`/missions/${id}`).then(r => setMission(r.data.data)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (canSave) void loadBookmarks(); }, [canSave, loadBookmarks]);

  async function handleApply() {
    if (!user) { router.push('/login'); return; }
    setApplying(true);
    try {
      await api.post('/submissions/apply', { missionId: id, message: applyMsg });
      setApplied(true);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '지원에 실패했습니다');
    } finally { setApplying(false); }
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) await navigator.share({ title: mission?.title ?? '맘브릿지 미션', url });
      else { await navigator.clipboard.writeText(url); setShareMsg('주소를 복사했어요'); setTimeout(() => setShareMsg(''), 2000); }
    } catch { /* 사용자가 취소한 경우 */ }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink border-t-transparent" />
    </div>
  );
  if (!mission) return (
    <div className="flex min-h-screen items-center justify-center bg-cream text-muted">미션을 찾을 수 없습니다</div>
  );

  const isOpen = mission.status === 'OPEN';
  const isFull = (mission.currentCount ?? 0) >= mission.maxParticipants;
  const dday = Math.ceil((new Date(mission.endDate).getTime() - Date.now()) / 86400000);
  const backHref = user?.role === 'PARTICIPANT' ? '/participant' : user?.role === 'OPERATOR' ? '/operator' : '/missions';
  const area = [mission.regionSi, mission.regionGu, mission.regionDong].filter(Boolean).join(' ');
  const net = Math.floor(Number(mission.rewardAmount) * 0.9);
  const points = MISSION_POINTS[mission.category] ?? MISSION_POINTS.SNS;
  const keywords: { keyword: string; role: 'MAIN' | 'SUB' }[] = mission.keywords ?? [];
  const images: { id: string; url: string }[] = mission.images ?? [];
  const momTags: string[] = mission.momTags ?? [];

  const steps: ScheduleStep[] = [
    { label: '신청', when: `${day(mission.startDate)} – ${day(mission.endDate)}`, current: isOpen, note: isOpen && dday >= 0 ? (dday === 0 ? 'D-Day' : `D-${dday}`) : null },
    // 발표일을 적지 않은 미션은 이 단계를 보여주지 않는다
    { label: '선정 발표', when: mission.announceDate ? day(mission.announceDate) : null },
    // 제출 마감이 모집 마감보다 앞서는 데이터도 있어, 역전되면 마감일만 보여준다
    {
      label: '방문 · 후기 등록',
      when: new Date(mission.submissionDeadline) > new Date(mission.endDate)
        ? `${day(mission.endDate)} – ${day(mission.submissionDeadline)}`
        : `${day(mission.submissionDeadline)}까지`,
      current: !isOpen,
    },
    // 약관 제8조에 따른 예정일. 휴일 보정까지 서버가 계산해 내려준다 (backend/src/lib/payout.ts)
    { label: '보상 지급', when: mission.payoutDueDate ? `늦어도 ${payoutLabel(new Date(mission.payoutDueDate))}` : null },
  ];

  const requirements = toLines(mission.requirements);
  const visitLines = toLines(mission.visitGuide);

  const ctaLabel = !user ? '로그인 후 신청하기'
    : user.role !== 'PARTICIPANT' ? (user.role === 'OPERATOR' ? '운영자 계정' : '고객사 계정')
    : applied ? '신청 완료'
    : !isOpen ? '모집 종료'
    : isFull ? '모집 마감'
    : applying ? '신청 중...' : '미션 신청하기';
  const ctaDisabled = !!user && (user.role !== 'PARTICIPANT' || applied || !isOpen || isFull || applying);

  return (
    <div className="min-h-screen bg-cream pb-[88px]">
      {/* 사진 — 여러 장이면 옆으로 넘기고 '1 / n'을 보여준다 */}
      <MissionGallery missionId={mission.id} businessCategory={mission.businessCategory} images={images}>
        <Link
          href={backHref} aria-label="목록으로"
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink"
        >
          <ChevronLeftIcon size={20} strokeWidth={1.8} />
        </Link>
        <button
          type="button" onClick={handleShare} aria-label="공유"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink"
        >
          <ShareIcon size={19} />
        </button>
        <span aria-live="polite" className="sr-only">{shareMsg}</span>
        {shareMsg && (
          <span className="absolute bottom-14 right-4 rounded-full bg-ink px-3 py-1 text-xs text-paper">{shareMsg}</span>
        )}
      </MissionGallery>

      <div className="mx-auto max-w-shell">
        {/* 정보 블록 */}
        <section className="border-b border-line bg-paper px-5 pb-[22px] pt-6">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 items-center rounded-full border border-line px-2.5 text-[11px] font-medium text-ink-2">
              {CATEGORY_LABEL[mission.category] ?? mission.category}
            </span>
            {mission.businessCategory && (
              <span className="flex h-6 items-center rounded-full border border-line px-2.5 text-[11px] font-medium text-ink-2">
                {BUSINESS_LABEL[mission.businessCategory] ?? mission.businessCategory}
              </span>
            )}
          </div>
          {momTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {momTags.map(t => <Tag key={t}>{MOM_TAG_LABEL[t] ?? t}</Tag>)}
            </div>
          )}
          <p className="mt-3.5 text-[13px] text-muted">{area}</p>
          <h1 className="mb-1.5 mt-1 font-serif text-title-lg font-bold">{mission.clientProfile?.businessName ?? mission.title}</h1>
          <p className="text-[15px] text-ink-2">{mission.title}</p>

          <div className="mt-[18px] flex items-end justify-between border-t border-line-soft pt-4">
            <div>
              <p className="text-xs text-muted">보상</p>
              <p className="mt-0.5 text-[22px] font-bold text-clay">{won(mission.rewardAmount)}</p>
              <p className="mt-0.5 text-xs text-muted">플랫폼 수수료 10% 공제 후 {won(net)} 지급</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">신청</p>
              <p className="mt-0.5 text-[15px] font-medium">
                {mission.currentCount ?? 0} <span className="font-normal text-muted">/ 모집 {mission.maxParticipants}</span>
              </p>
            </div>
          </div>
        </section>

        {/* 일정 */}
        <section className="mx-5 mt-4 rounded-card border border-line bg-paper p-5">
          <span className="font-accent text-sm italic text-clay">Schedule</span>
          <h2 className="mb-3.5 mt-0.5 font-serif text-section-sm font-bold">일정</h2>
          <ScheduleTimeline steps={steps} />
        </section>

        {/* 신청 전 확인 */}
        {requirements.length > 0 && (
          <div className="mx-5 mt-3">
            <NoticeBox title="신청 전 꼭 확인해 주세요" items={requirements} />
          </div>
        )}

        {/* 방문 안내 — 지도는 자리만, 체험 시간·휴무는 데이터가 없어 숨긴다 */}
        {(mission.clientProfile?.address || mission.visitHours || visitLines.length > 0) && (
          <Section eyebrow="Visit" title="방문 안내">
            <div className="flex h-[150px] items-center justify-center rounded-photo bg-[#E2DCCF] text-xs text-[#5E5A46]">지도</div>
            <dl className="mt-3.5 grid grid-cols-[76px_1fr] gap-y-2.5 text-sm">
              {mission.clientProfile?.address && (
                <>
                  <dt className="text-muted">주소</dt>
                  <dd className="m-0">{mission.clientProfile.address}</dd>
                </>
              )}
              {mission.visitHours && (
                <>
                  <dt className="text-muted">방문 가능</dt>
                  <dd className="m-0">{mission.visitHours}</dd>
                </>
              )}
              {visitLines.length > 0 && (
                <>
                  <dt className="text-muted">안내</dt>
                  <dd className="m-0 space-y-1">{visitLines.map((t, i) => <p key={i}>{t}</p>)}</dd>
                </>
              )}
            </dl>
          </Section>
        )}

        {/* 미션 내용 */}
        <Section eyebrow="Mission" title="미션 내용">
          <div className="grid grid-cols-4 gap-2">
            {points.map(({ Icon, label }) => (
              <div key={label} className="rounded-control border border-line bg-paper px-1 py-3.5 text-center text-xs text-ink-2">
                <Icon size={22} strokeWidth={1.5} className="mx-auto mb-1.5 block text-clay" />
                {label}
              </div>
            ))}
          </div>
          {mission.description && (
            <p className="mt-3.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{mission.description}</p>
          )}
          <div className="mt-3.5">
            <KeywordBox
              main={keywords.filter(k => k.role === 'MAIN').map(k => k.keyword)}
              sub={keywords.filter(k => k.role === 'SUB').map(k => k.keyword)}
            />
          </div>
        </Section>

        {/* 성과 기록 안내 */}
        <section className="mx-5 mt-7 rounded-card bg-ink px-5 py-[18px] text-paper">
          <p className="text-[13px] text-[#CFC4B4]">이 미션은 성과가 기록돼요</p>
          <p className="mt-1.5 text-sm leading-[1.65]">내 후기를 보고 가게를 찾은 방문 수를 &apos;내 활동&apos;에서 확인할 수 있어요.</p>
        </section>

        {/* 지원 동기 — 선택 입력. 신청할 수 있는 참여자에게만 보인다 */}
        {user?.role === 'PARTICIPANT' && isOpen && !isFull && !applied && (
          <Section eyebrow="Apply" title="지원 동기">
            <label htmlFor="apply-msg" className="sr-only">지원 동기 (선택)</label>
            <textarea
              id="apply-msg" rows={3} value={applyMsg} onChange={e => setApplyMsg(e.target.value)}
              placeholder="간단히 적어 주세요 (선택)"
              className="w-full resize-none rounded-photo border border-line bg-paper p-4 text-sm text-ink outline-none placeholder:text-muted"
            />
          </Section>
        )}

        {/* 댓글 — 미션 댓글 API가 아직 없어 기존과 같이 자리만 둔다 */}
        <Section eyebrow="Comments" title="댓글">
          <div className="rounded-card border border-line bg-paper p-5">
            <p className="py-6 text-center text-sm text-muted">아직 댓글이 없습니다</p>
            {user && (
              <div className="flex gap-2 border-t border-line-soft pt-4">
                <input
                  disabled
                  className="min-w-0 flex-1 rounded-control border border-line bg-cream px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
                  placeholder="댓글 기능은 준비 중이에요"
                />
                <button disabled className="shrink-0 rounded-control bg-ink px-4 py-2 text-sm font-medium text-paper opacity-50">
                  등록
                </button>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* 하단 고정: 찜 + 신청. 찜은 참여자 본인만 */}
      <StickyCTA
        label={ctaLabel} onPress={handleApply} disabled={ctaDisabled}
        saved={savedIds.has(String(id))}
        onToggleSave={canSave ? () => void toggleBookmark(String(id)) : undefined}
      />
    </div>
  );
}
