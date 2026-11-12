'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthHydrated, useAuthStore } from '@/store/auth';
import { KeywordBox, NoticeBox, StickyCTA, Tag } from '@/components/ui';
import { CameraIcon, ChevronLeftIcon, DocIcon, HeartIcon, KeywordIcon, LinkIcon, PinIcon, ShareIcon } from '@/components/ui/icons';
import MissionGallery from '@/components/missions/MissionGallery';
import { BUSINESS_LABEL, MOM_TAG_LABEL } from '@/components/missions/MissionBrowser';
import { useBookmarks } from '@/lib/bookmarks';
import { toLines } from '@/lib/lines';
import { PAYOUT_DELAY_HINT, payoutLabel } from '@/lib/payout';
import { PLATFORM_FEE_PERCENT, netReward } from '@/lib/fees';

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
/** 일정 날짜: "11월 20일" (14px로 읽히게 숫자를 줄이지 않는다) */
const monthDay = (d: string | Date) => { const t = new Date(d); return `${t.getMonth() + 1}월 ${t.getDate()}일`; };

/** 번호 일정 한 줄. 지금 단계는 번호를 clay로 채운다 */
interface DetailStep { label: string; when: string | null; current?: boolean; hint?: string | null }

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
  const hydrated = useAuthHydrated();
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
  // null = 아직 모름 (불러오는 중이거나 참여자가 아님)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    api.get(`/missions/${id}`).then(r => setMission(r.data.data)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (canSave) void loadBookmarks(); }, [canSave, loadBookmarks]);

  useEffect(() => {
    if (!canSave) return;
    api.get('/participant/profile')
      .then(r => setProfileComplete(!!r.data.data.complete))
      .catch(() => setProfileComplete(null));
  }, [canSave]);

  async function handleApply() {
    // 로그인 정보를 다 읽기 전에는 판단하지 않는다
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    // 프로필이 덜 찼으면 지원 대신 프로필 화면으로 보낸다 (서버도 422로 막는다)
    if (profileComplete === false) { router.push('/participant?tab=profile'); return; }
    setApplying(true);
    try {
      await api.post('/submissions/apply', { missionId: id, message: applyMsg });
      setApplied(true);
      // 신청 현황을 바로 반영한다 (다시 불러오지 않아도 숫자가 맞게)
      setMission((prev: any) => (prev ? { ...prev, currentCount: (prev.currentCount ?? 0) + 1 } : prev));
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
  const net = netReward(Number(mission.rewardAmount));
  const points = MISSION_POINTS[mission.category] ?? MISSION_POINTS.SNS;
  const keywords: { keyword: string; role: 'MAIN' | 'SUB' }[] = mission.keywords ?? [];
  const images: { id: string; url: string }[] = mission.images ?? [];
  const momTags: string[] = mission.momTags ?? [];

  // 번호 일정 — 서버에 있는 날짜만 쓴다 (모집 마감 · 선정 발표 · 후기 마감 · 지급 예정일)
  const steps: DetailStep[] = ([
    { label: '모집', when: `${monthDay(mission.endDate)}까지`, current: isOpen },
    // 발표일을 적지 않은 미션은 이 줄을 보여주지 않는다. 선정은 맘브릿지(운영자)가 한다
    { label: '선정 발표', when: mission.announceDate ? monthDay(mission.announceDate) : null },
    { label: '방문하고 후기 제출', when: `${monthDay(mission.submissionDeadline)}까지`, current: !isOpen },
    // 약관 제8조에 따른 예정일. 휴일 보정까지 서버가 계산해 내려준다 (backend/src/lib/payout.ts)
    {
      label: '보상 지급',
      when: mission.payoutDueDate ? payoutLabel(new Date(mission.payoutDueDate)) : null,
      hint: mission.payoutDueDate ? PAYOUT_DELAY_HINT : null,
    },
  ] as DetailStep[]).filter(st => st.when);
  // 하단 버튼 왼쪽: 모집 중일 때만 마감까지 남은 날
  const ctaMeta = isOpen && dday >= 0 ? { label: '모집 마감', value: dday === 0 ? 'D-Day' : `D-${dday}` } : null;
  // 가게 이름 · 구 동 (동은 있는 미션만)
  const shopLine = [mission.clientProfile?.businessName, [mission.regionGu, mission.regionDong].filter(Boolean).join(' ')]
    .filter(Boolean).join(' · ');

  const requirements = toLines(mission.requirements);
  const visitLines = toLines(mission.visitGuide);

  const ctaLabel = !user ? '로그인 후 신청하기'
    : user.role !== 'PARTICIPANT' ? (user.role === 'OPERATOR' ? '운영자 계정' : '고객사 계정')
    : applied ? '신청 완료'
    : !isOpen ? '모집 종료'
    : isFull ? '모집 마감'
    // 활동 지역·SNS 계정이 없으면 지원 대신 프로필을 채우러 보낸다
    : profileComplete === false ? '프로필 완성하고 지원하기'
    : applying ? '신청 중...' : '미션 신청하기';
  const ctaDisabled = !!user && (
    user.role !== 'PARTICIPANT' || applied || !isOpen || isFull
    || (applying && profileComplete !== false)
  );

  return (
    <div className="min-h-screen bg-cream pb-[calc(88px+env(safe-area-inset-bottom))]">
      {/* 사진 — 여러 장이면 옆으로 넘기고 '1 / n'을 보여준다 */}
      <MissionGallery missionId={mission.id} businessCategory={mission.businessCategory} images={images}>
        <Link
          href={backHref} aria-label="목록으로"
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink"
        >
          <ChevronLeftIcon size={20} strokeWidth={1.8} />
        </Link>
        <div className="absolute right-3 top-3 flex gap-2">
          {canSave && (
            <button
              type="button" onClick={() => void toggleBookmark(String(id))}
              aria-label={savedIds.has(String(id)) ? '찜 해제' : '찜하기'} aria-pressed={savedIds.has(String(id))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink"
            >
              <HeartIcon className={savedIds.has(String(id)) ? 'fill-clay text-clay' : undefined} />
            </button>
          )}
          <button
            type="button" onClick={handleShare} aria-label="공유"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink"
          >
            <ShareIcon size={19} />
          </button>
        </div>
        <span aria-live="polite" className="sr-only">{shareMsg}</span>
        {shareMsg && (
          <span className="absolute bottom-14 right-4 rounded-full bg-ink px-3 py-1 text-xs text-paper">{shareMsg}</span>
        )}
      </MissionGallery>

      {/* 사진 위로 둥근 시트가 24px 겹쳐 올라온다 */}
      <div className="relative z-10 mx-auto -mt-6 max-w-shell rounded-t-[24px] bg-cream">
        {/* 정보 블록 */}
        <section className="px-5 pb-2 pt-6">
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
          <p className="mt-3.5 text-[13px] text-muted">{shopLine || area}</p>
          <h1 className="mt-1 break-keep font-serif text-title font-bold leading-[1.35]">{mission.title}</h1>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="sr-only">보상</p>
              <p className="text-[22px] font-bold text-clay">{won(mission.rewardAmount)}</p>
              <p className="mt-0.5 text-xs text-muted">플랫폼 수수료 {PLATFORM_FEE_PERCENT}% 빼고 {won(net)} 지급</p>
            </div>
            <p className="text-[13.5px] text-ink-2">
              모집 <b className="font-bold text-ink">{mission.currentCount ?? 0}</b> / {mission.maxParticipants}명
            </p>
          </div>

          {mission.visitHours && (
            <p className="mt-3 flex items-center gap-2 rounded-control border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink-2">
              <PinIcon size={16} strokeWidth={1.8} className="shrink-0 text-clay" />
              방문 가능 {mission.visitHours}
            </p>
          )}
        </section>

        {/* 일정 — 번호 목록. 날짜를 14px로 읽히게 */}
        <section className="mt-5 px-5" aria-labelledby="schedule-title">
          <h2 id="schedule-title" className="font-serif text-section-sm font-bold">일정</h2>
          <ol className="m-0 mt-1 list-none p-0">
            {steps.map((st, i) => (
              <li key={st.label} className="flex gap-3 py-2">
                <span
                  aria-hidden="true"
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    st.current ? 'bg-clay text-paper' : 'bg-clay-tint text-clay-dark'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-[15px] ${st.current ? 'font-bold' : 'font-medium'}`}>
                      {st.label}{st.current && <span className="sr-only"> (지금 단계)</span>}
                    </span>
                    <span className={`whitespace-nowrap text-sm ${st.current ? 'font-bold text-clay-dark' : 'text-ink-2'}`}>{st.when}</span>
                  </div>
                  {st.hint && <p className="mt-0.5 break-keep text-right text-xs leading-[1.5] text-muted">{st.hint}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 신청 전 확인 */}
        {requirements.length > 0 && (
          <div className="mx-5 mt-3">
            <NoticeBox title="신청 전 꼭 확인해 주세요" items={requirements} />
          </div>
        )}

        {/* 방문 안내 — 지도는 자리만, 체험 시간·휴무는 데이터가 없어 숨긴다 */}
        {(mission.clientProfile?.address || visitLines.length > 0) && (
          <Section eyebrow="Visit" title="방문 안내">
            <div className="flex h-[150px] items-center justify-center rounded-photo bg-[#E2DCCF] text-xs text-[#5E5A46]">지도</div>
            <dl className="mt-3.5 grid grid-cols-[76px_1fr] gap-y-2.5 text-sm">
              {mission.clientProfile?.address && (
                <>
                  <dt className="text-muted">주소</dt>
                  <dd className="m-0">{mission.clientProfile.address}</dd>
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

      {/* 하단 고정: 왼쪽에 모집 마감까지 남은 날, 오른쪽 신청. 찜은 사진 위로 옮겼다 */}
      <StickyCTA label={ctaLabel} onPress={handleApply} disabled={ctaDisabled} meta={ctaMeta} />
    </div>
  );
}
