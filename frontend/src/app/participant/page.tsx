'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { syncSelfClickCookie } from '@/lib/self-click';
import { useAuthStore } from '@/store/auth';
import { PostCheckSummary, ReviewGuideModal } from '@/components/campaign/ReviewGuide';
import { BottomTabBar, BottomTabBarSpacer, CategoryTabs, SiteHeader } from '@/components/ui';
import { photoTone } from '@/components/ui/MissionCard';
import { BellIcon, LogOutIcon } from '@/components/ui/icons';

/** 기준: docs/design/mombridge-design/cream-editorial-v1.md 3번 '참여자 내 활동' + Participant.html */

type Tab = 'active' | 'applications' | 'submissions' | 'payouts';

const TABS = [
  { value: 'active', label: '진행 중' },
  { value: 'applications', label: '지원 현황' },
  { value: 'submissions', label: '제출 내역' },
  { value: 'payouts', label: '보상 내역' },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토 중', APPROVED: '승인', REJECTED: '반려', CANCELED: '취소',
  SUBMITTED: '검수 중', REVISION: '수정 요청',
  PENDING_PAYOUT: '정산 대기', COMPLETED: '지급 완료',
};

/** 상태 배지 — 진행·확인 필요는 clay, 완료는 sage, 그 밖은 선 */
function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED' || status === 'COMPLETED' ? 'bg-sage-tint text-sage'
    : status === 'REJECTED' || status === 'CANCELED' ? 'border border-line text-muted'
    : 'bg-clay-tint text-clay-dark';
  return (
    <span className={`flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-xs ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const won = (n: unknown) => `${Number(n ?? 0).toLocaleString()}원`;
const dateK = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\.$/, '');

/** 보상은 매월 말일 마감 → 다음 달 10일 지급 (약관 제8조) */
function nextPayoutLabel(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), 10);
  if (now.getDate() >= 10) d.setMonth(d.getMonth() + 1);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 계좌번호는 끝 4자리만 보여 준다 */
function maskAccount(account?: string | null) {
  const digits = String(account ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `****-${digits.slice(-4)}` : '****';
}

const STAGES = ['선정', '방문', '후기 제출', '검수', '지급'];

/** 지원·제출·정산 상태를 5단계 중 어디인지로 바꾼다 */
function stageIndex(sub: any, payout: any) {
  if (payout?.status === 'COMPLETED') return 4;
  if (sub?.status === 'APPROVED') return 4;
  if (sub?.status === 'SUBMITTED') return 3;
  return 2; // 아직 제출 전이거나 수정 요청 — '후기 제출' 단계
}

function StageBar({ current }: { current: number }) {
  return (
    <ol aria-label="진행 단계" className="m-0 mt-[18px] grid list-none grid-cols-5 gap-1 p-0">
      {STAGES.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className={`text-center text-[11px] ${now ? 'font-bold text-clay' : done ? 'text-ink' : 'text-muted'}`}>
            <span className={`mb-1.5 block h-1 rounded ${done ? 'bg-clay' : now ? 'bg-[#E3C2AC]' : 'bg-line'}`} />
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export default function ParticipantPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const clearAuth = useAuthStore(s => s.clearAuth);

  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);

  const [applications, setApplications] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<Record<string, { clicks: number; uniqueVisitors: number }>>({});

  const [submitModal, setSubmitModal] = useState<any>(null);
  const [submitForm, setSubmitForm] = useState({ description: '', snsPostUrl: '' });
  const [submittingContent, setSubmittingContent] = useState(false);
  const [guideMissionId, setGuideMissionId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<any>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => { setHydrated(true); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [appR, subR, payR, statsR] = await Promise.all([
        api.get('/participant/applications'),
        api.get('/submissions/my'),
        api.get('/participant/payouts'),
        api.get('/participant/reviews/stats').catch(() => ({ data: { data: [] } })),
      ]);
      setApplications(appR.data.data);
      setSubmissions(subR.data.data);
      setPayouts(payR.data.data);
      setReviewStats(Object.fromEntries(statsR.data.data.map((x: any) => [x.missionId, x])));
    } catch { /* 각 목록은 비어 있는 상태로 둔다 */ } finally { setLoading(false); }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setNotifications(r.data.data.notifications);
      setUnreadCount(r.data.data.unreadCount);
    } catch { /* 알림은 없어도 화면이 동작한다 */ }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'PARTICIPANT' && user.role !== 'OPERATOR') { router.push('/'); return; }
    void loadAll();
    void loadNotifications();
    // 이미 로그인해 있던 체험단원도 본인 클릭 표시를 받는다 (만료 연장 겸)
    if (user.role === 'PARTICIPANT') void syncSelfClickCookie();
  }, [user, hydrated, loadAll, loadNotifications, router]);

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* 실패해도 목록은 그대로 둔다 */ }
  }

  async function handleSubmitContent(e: React.FormEvent) {
    e.preventDefault();
    if (!submitModal) return;
    setSubmittingContent(true);
    try {
      const saved = submitModal.resubmitId
        ? (await api.patch(`/submissions/${submitModal.resubmitId}/resubmit`, submitForm)).data.data
        : (await api.post('/submissions', { missionId: submitModal.missionId, ...submitForm })).data.data;
      setSubmitModal(null);
      setSubmitForm({ description: '', snsPostUrl: '' });
      await loadAll();
      if (saved?.postCheckResult) setCheckResult(saved);
      else alert('제출 완료! 운영자 검수 후 정산됩니다.');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '제출에 실패했습니다');
    } finally { setSubmittingContent(false); }
  }

  const subByMission = new Map(submissions.map(s => [s.missionId, s]));
  const payoutByMission = new Map(payouts.map(p => [p.submission?.missionId, p]));

  // 지급 예정 금액은 운영자가 만든 Payout 행에서만 나온다.
  // 제출물이 '승인'돼도 정산이 잡히기 전에는 행이 없어, 그 경우를 따로 안내한다 (약관 제8조:
  // 매월 말일까지 승인된 건 → 다음 달 10일 지급)
  const pendingPay = payouts.filter(p => p.status !== 'COMPLETED');
  const nextAmount = pendingPay.reduce((sum, p) => sum + Number(p.netAmount ?? 0), 0);
  const payoutMissionIds = new Set(payouts.map(p => p.submission?.missionId));
  const approvedAwaitingPayout = submissions.filter(
    s => s.status === 'APPROVED' && !payoutMissionIds.has(s.missionId),
  ).length;
  const totalEarned = payouts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + Number(p.netAmount ?? 0), 0);
  const applyingCount = applications.filter(a => a.status === 'PENDING').length;
  const activeApps = applications.filter(a => a.status === 'APPROVED' && payoutByMission.get(a.missionId)?.status !== 'COMPLETED');
  /** 계좌는 지급 기록에만 남는다 — 가장 최근 것을 보여 준다 */
  const account = payouts.find(p => p.bankAccount);

  if (!hydrated || !user) return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-shell space-y-4 px-5 py-6">
        <div className="h-8 w-32 animate-pulse rounded bg-line-soft" />
        <div className="h-44 animate-pulse rounded-box bg-line-soft" />
        <div className="h-11 animate-pulse rounded bg-line-soft" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader showSearch={false} showMyLink={false} />

      <div className="mx-auto max-w-shell">
        <header className="flex items-center justify-between gap-2 px-5 pb-1 pt-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="font-serif text-title font-bold">내 활동</h1>
            {user.role === 'OPERATOR' && (
              <Link href="/operator" className="shrink-0 rounded-full border border-line px-2 py-1 text-xs text-muted">
                운영자
              </Link>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative" ref={notifRef}>
              <button
                type="button" aria-label="알림"
                onClick={() => { setShowNotif(v => !v); if (!showNotif) void loadNotifications(); }}
                className="relative flex h-11 w-11 items-center justify-center text-ink"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-paper">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-card border border-line bg-paper shadow-lg">
                  <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                    <span className="text-sm font-medium">알림</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-muted">전체 읽음</button>
                    )}
                  </div>
                  <div className="max-h-80 divide-y divide-line-soft overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted">알림이 없습니다</p>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 ${n.isRead ? '' : 'bg-cream'}`}>
                        <p className={`text-sm ${n.isRead ? 'text-ink-2' : 'font-medium text-ink'}`}>{n.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button" aria-label="로그아웃"
              onClick={() => { clearAuth(); router.push('/login'); }}
              className="flex h-11 w-11 items-center justify-center text-muted"
            >
              <LogOutIcon size={20} />
            </button>
          </div>
        </header>

        {/* 이번 달 요약 */}
        <section className="mx-5 mt-3 rounded-box bg-ink px-5 py-[22px] text-paper">
          <span className="font-accent text-sm italic text-[#D9A27F]">This month</span>
          <p className="mt-1 text-[13px] text-[#CFC4B4]">
            {pendingPay.length > 0 ? `${nextPayoutLabel()}에 받을 보상` : '다음 정산일 ' + nextPayoutLabel()}
          </p>
          <p className="mt-1 font-serif text-hero font-bold">{won(nextAmount)}</p>
          <p className="mt-1 text-xs text-[#CFC4B4]">
            {pendingPay.length > 0
              ? `수수료·세금 공제 후 · 정산 대기 ${pendingPay.length}건`
              : approvedAwaitingPayout > 0
                ? `승인된 ${approvedAwaitingPayout}건은 정산이 잡히면 금액이 표시돼요`
                : '아직 정산 대기 중인 건이 없어요'}
          </p>
          <div className="mt-[18px] grid grid-cols-3 border-t border-[#3A332B] pt-3.5">
            {[
              { label: '지원 중', value: String(applyingCount) },
              { label: '진행 중', value: String(activeApps.length) },
              { label: '누적 보상', value: won(totalEarned) },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-[#CFC4B4]">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-[22px]">
          <CategoryTabs tabs={TABS} value={tab} onChange={v => setTab(v as Tab)} ariaLabel="내 활동 메뉴" />
        </div>

        {loading ? (
          <div className="space-y-3 px-5 pt-[18px]">
            {[1, 2].map(i => <div key={i} className="h-36 animate-pulse rounded-card bg-line-soft" />)}
          </div>
        ) : (
          <>
            {/* 진행 중 */}
            {tab === 'active' && (
              <div className="space-y-3 px-5 pt-[18px]">
                {activeApps.map(a => {
                  const sub = subByMission.get(a.missionId);
                  const payout = payoutByMission.get(a.missionId);
                  const current = stageIndex(sub, payout);
                  const stats = reviewStats[a.missionId];
                  const tone = photoTone(a.missionId);
                  const deadline = a.mission?.submissionDeadline;
                  const dday = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <section key={a.id} className="rounded-card border border-line bg-paper p-[18px]">
                      <div className="flex items-center gap-3">
                        <div className={`h-14 w-14 shrink-0 rounded-control ${tone.bg}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium">
                            {a.mission?.clientProfile?.businessName
                              ? `[${a.mission.regionDong || a.mission.regionGu}] ${a.mission.clientProfile.businessName}`
                              : a.mission?.title}
                          </p>
                          <p className="mt-[3px] text-xs text-muted">
                            {deadline ? <>후기 마감 {dateK(deadline)}{dday !== null && dday >= 0 && <> · <b className="font-medium text-clay">D-{dday}</b></>}</> : '일정 미정'}
                          </p>
                        </div>
                        {sub && <StatusBadge status={sub.status} />}
                      </div>

                      <StageBar current={current} />

                      {stats && (
                        <div className="mt-3.5 rounded-control bg-cream p-3.5">
                          <p className="text-xs text-muted">내 후기로 들어온 방문</p>
                          <p className="mt-1 text-[15px]">
                            <b className="text-xl">{stats.clicks}</b>회{' '}
                            <span className="text-[13px] text-muted">· 고유 방문자 {stats.uniqueVisitors}명</span>
                          </p>
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        {!sub && (
                          <button
                            onClick={() => { setSubmitForm({ description: '', snsPostUrl: '' }); setSubmitModal(a); }}
                            className="flex h-12 w-full items-center justify-center rounded-control bg-clay text-sm font-bold text-paper"
                          >
                            후기 링크 제출하기
                          </button>
                        )}
                        {sub?.status === 'REVISION' && sub.revisionCount < sub.maxRevisions && (
                          <button
                            onClick={() => {
                              setSubmitForm({ description: sub.description ?? '', snsPostUrl: sub.snsPostUrl ?? '' });
                              setSubmitModal({ ...sub, resubmitId: sub.id });
                            }}
                            className="flex h-12 w-full items-center justify-center rounded-control bg-clay text-sm font-bold text-paper"
                          >
                            수정해서 다시 제출하기 ({sub.revisionCount}/{sub.maxRevisions})
                          </button>
                        )}
                        {sub?.status === 'SUBMITTED' && (
                          <p className="text-center text-[13px] text-muted">검수 중 · 보통 2일 안에 결과가 나와요</p>
                        )}
                        {sub?.status === 'APPROVED' && (
                          <p className="text-center text-[13px] text-muted">{nextPayoutLabel()}에 지급될 예정이에요</p>
                        )}
                        <button
                          onClick={() => setGuideMissionId(a.missionId)}
                          className="flex h-11 w-full items-center justify-center rounded-control border border-line text-sm text-ink-2"
                        >
                          작성 가이드 · 추적 링크 복사
                        </button>
                      </div>
                    </section>
                  );
                })}
                {activeApps.length === 0 && (
                  <EmptyBox>진행 중인 미션이 없어요. <Link href="/missions" className="font-medium text-clay">미션 둘러보기</Link></EmptyBox>
                )}
              </div>
            )}

            {/* 지원 현황 */}
            {tab === 'applications' && (
              <div className="space-y-3 px-5 pt-[18px]">
                {applications.map(a => (
                  <section key={a.id} className="rounded-card border border-line bg-paper p-[18px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium">{a.mission?.title}</p>
                        <p className="mt-1 text-xs text-muted">지원일 {dateK(a.createdAt)}</p>
                        {a.rejectionReason && <p className="mt-1 text-[13px] text-clay-dark">반려 사유: {a.rejectionReason}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={a.status} />
                        <p className="mt-1 text-sm font-bold text-clay">{won(a.mission?.rewardAmount)}</p>
                      </div>
                    </div>
                  </section>
                ))}
                {applications.length === 0 && <EmptyBox>지원한 미션이 없어요.</EmptyBox>}
              </div>
            )}

            {/* 제출 내역 */}
            {tab === 'submissions' && (
              <div className="space-y-3 px-5 pt-[18px]">
                {submissions.map(s => (
                  <section key={s.id} className="rounded-card border border-line bg-paper p-[18px]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[15px] font-medium">{s.mission?.title}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    {s.description && <p className="mt-2 rounded-control bg-cream p-3 text-[13px] text-ink-2">{s.description}</p>}
                    {s.reviewNote && <p className="mt-2 text-[13px] text-ink-2">검수 메모: {s.reviewNote}</p>}
                    {s.rejectionReason && <p className="mt-2 text-[13px] text-clay-dark">반려 사유: {s.rejectionReason}</p>}
                    <p className="mt-2 text-xs text-muted">제출 {dateK(s.submittedAt)}</p>
                    {reviewStats[s.missionId] && (
                      <div className="mt-2.5 rounded-control bg-cream p-3.5">
                        <p className="text-xs text-muted">내 후기로 들어온 방문</p>
                        <p className="mt-1 text-[15px]">
                          <b className="text-xl">{reviewStats[s.missionId].clicks}</b>회{' '}
                          <span className="text-[13px] text-muted">· 고유 방문자 {reviewStats[s.missionId].uniqueVisitors}명</span>
                        </p>
                        <p className="mt-1 text-[11px] text-muted">추적 링크를 눌러 넘어온 방문만 집계됩니다. 블로그 조회수와는 다릅니다.</p>
                      </div>
                    )}
                    {s.postCheckResult && <div className="mt-2 border-t border-line-soft pt-2"><PostCheckSummary submission={s} /></div>}
                    {s.status === 'REVISION' && s.revisionCount < s.maxRevisions && (
                      <button
                        onClick={() => {
                          setSubmitForm({ description: s.description ?? '', snsPostUrl: s.snsPostUrl ?? '' });
                          setSubmitModal({ ...s, resubmitId: s.id });
                        }}
                        className="mt-3 flex h-12 w-full items-center justify-center rounded-control bg-clay text-sm font-bold text-paper"
                      >
                        수정해서 다시 제출하기 ({s.revisionCount}/{s.maxRevisions})
                      </button>
                    )}
                  </section>
                ))}
                {submissions.length === 0 && <EmptyBox>제출한 콘텐츠가 없어요.</EmptyBox>}
              </div>
            )}

            {/* 보상 내역 */}
            {tab === 'payouts' && (
              <div className="px-5 pt-[18px]">
                <div className="space-y-3">
                  {payouts.map(p => (
                    <section key={p.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper p-[18px]">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium">{p.submission?.mission?.title}</p>
                        <p className="mt-1 text-xs text-muted">{dateK(p.createdAt)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-clay">{won(p.netAmount)}</p>
                        <p className="text-xs text-muted">수수료 -{won(p.platformFee)}</p>
                        <div className="mt-1 flex justify-end"><StatusBadge status={p.status} /></div>
                      </div>
                    </section>
                  ))}
                  {payouts.length === 0 && <EmptyBox>아직 보상 내역이 없어요.</EmptyBox>}
                </div>

                {/* 계좌는 지급 기록에만 남는다 — 등록·변경 기능은 아직 없다 */}
                <section className="mt-7">
                  <span className="font-accent text-sm italic text-clay">Payout</span>
                  <h2 className="mb-3 mt-0.5 font-serif text-section-sm font-bold">보상 받을 계좌</h2>
                  <div className="rounded-photo border border-line bg-paper p-4">
                    {account ? (
                      <>
                        <p className="text-sm font-medium">[{account.bankName ?? '은행'}] {maskAccount(account.bankAccount)}</p>
                        <p className="mt-0.5 text-xs text-muted">예금주 {account.accountHolder ?? '-'}</p>
                      </>
                    ) : (
                      <p className="text-[13px] leading-[1.6] text-muted">
                        아직 등록된 계좌가 없어요. 첫 지급 전에 운영자가 계좌를 확인해 드려요.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>

      {/* 콘텐츠 제출 모달 */}
      {submitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-lg rounded-box bg-paper">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-serif text-section-sm font-bold">{submitModal.resubmitId ? '콘텐츠 다시 제출' : '후기 링크 제출'}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{submitModal.mission?.title}</p>
              </div>
              <button onClick={() => setSubmitModal(null)} aria-label="닫기" className="h-11 w-11 shrink-0 text-xl text-muted">×</button>
            </div>
            <form onSubmit={handleSubmitContent} className="space-y-4 p-5">
              <div>
                <label htmlFor="sub-desc" className="mb-1 block text-[13px] text-muted">활동 내용 *</label>
                <textarea
                  id="sub-desc" required rows={4} value={submitForm.description}
                  onChange={e => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="미션 수행 내용을 적어 주세요"
                  className="w-full resize-none rounded-control border border-line bg-cream p-3 text-sm outline-none"
                />
              </div>
              <div>
                <label htmlFor="sub-url" className="mb-1 block text-[13px] text-muted">
                  게시물 주소 (블로그 리뷰 미션은 네이버 블로그 글 주소 필수)
                </label>
                <input
                  id="sub-url" value={submitForm.snsPostUrl}
                  onChange={e => setSubmitForm(f => ({ ...f, snsPostUrl: e.target.value }))}
                  placeholder="https://blog.naver.com/아이디/글번호"
                  className="w-full rounded-control border border-line bg-cream p-3 text-sm outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSubmitModal(null)} className="h-11 rounded-control border border-line px-4 text-sm text-ink-2">취소</button>
                <button type="submit" disabled={submittingContent} className="h-11 rounded-control bg-clay px-6 text-sm font-bold text-paper disabled:opacity-50">
                  {submittingContent ? '제출 중...' : '제출하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {guideMissionId && <ReviewGuideModal missionId={guideMissionId} onClose={() => setGuideMissionId(null)} />}

      {checkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-box bg-paper p-5">
            <h2 className="font-serif text-section-sm font-bold">제출 완료 · 자동 확인 결과</h2>
            <PostCheckSummary submission={checkResult} />
            <button onClick={() => setCheckResult(null)} className="h-12 w-full rounded-control bg-ink text-sm font-bold text-paper">확인</button>
          </div>
        </div>
      )}

      <BottomTabBarSpacer />
      <BottomTabBar />
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-photo border border-dashed border-[#D8CBB8] bg-paper p-4 text-[13px] leading-[1.6] text-ink-2">
      {children}
    </p>
  );
}
