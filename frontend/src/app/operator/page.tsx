'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { LogOutIcon } from '@/components/ui/icons';
import MissionImageUploader, { uploadPendingImages, type PendingImage } from '@/components/missions/MissionImageUploader';
import { missionDateError } from '@/lib/mission-dates';
import { SubmissionCheckPanel, TrafficSummary } from '@/components/operator/OperatorCampaignTools';
import SettingsEditor from '@/components/operator/SettingsEditor';
import PayoutAccount from '@/components/operator/PayoutAccount';
import SubmissionReviewCard from '@/components/operator/SubmissionReviewCard';
import MissionEditModal from '@/components/missions/MissionEditModal';
import RegisterMissionForm from '@/components/operator/RegisterMissionForm';
import {
  CardList, CardRow, DangerButton, EmptyRow, PrimaryButton, QuietButton,
  ShortDate, StatusBadge, TableBox, TableHead, Won,
} from '@/components/operator/ui';

type Tab = 'overview' | 'missions' | 'applications' | 'submissions' | 'payouts' | 'users' | 'register-mission' | 'traffic' | 'settings';

/** 상태 막대 색 — 진행·확인 필요 clay / 완료 sage / 종료 ink / 임시저장 line */
const MISSION_STATUS_BAR: Record<string, string> = {
  DRAFT: 'bg-line', OPEN: 'bg-clay', IN_PROGRESS: 'bg-clay-dark',
  REVIEWING: 'bg-[#E3C2AC]', CLOSED: 'bg-ink', COMPLETED: 'bg-sage',
};

const MISSION_STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료' };
const MISSION_STATUS_COLOR: Record<string, string> = { DRAFT: 'bg-cream text-ink-2', OPEN: 'bg-sage-tint text-sage', IN_PROGRESS: 'bg-sage-tint text-sage', REVIEWING: 'bg-clay-tint text-clay-dark', CLOSED: 'bg-clay-tint text-clay-dark' };
const ROLE_LABEL: Record<string, string> = { OPERATOR: '운영자', PARTICIPANT: '참여자', CLIENT: '고객사' };

export default function OperatorDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Record<string, number> & { missionsByStatus?: { status: string; _count: number }[] } | null>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [photoMissionId, setPhotoMissionId] = useState<string | null>(null);
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [registerForm, setRegisterForm] = useState({
    clientProfileId: '', title: '', description: '', category: 'SNS',
    rewardAmount: '', maxParticipants: '5', regionSi: '', regionGu: '',
    regionDong: '', visitAddress: '',
    startDate: '', endDate: '', submissionDeadline: '', requirements: '', visitGuide: '',
    businessCategory: '', momTags: [] as string[], visitHours: '', announceDate: '',
    sendPaymentLink: false,
  });
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'OPERATOR') { router.push('/'); return; }
    loadStats();
  }, [user]);

  async function loadStats() {
    const { data } = await api.get('/operator/stats');
    // 개요의 검수 대기 표와 정산 대기 카드에 쓸 자료 (실패해도 개요는 그려진다)
    void Promise.all([
      api.get('/submissions/pending').then(r => setSubmissions(r.data.data)).catch(() => {}),
      api.get('/operator/payouts?status=PENDING').then(r => setPayouts(r.data.data)).catch(() => {}),
    ]);
    setStats(data.data);
  }

  const loadTab = useCallback(async (t: Tab) => {
    setTab(t);
    setLoading(true);
    try {
      if (t === 'missions') { const r = await api.get('/operator/missions'); setMissions(r.data.data.missions); }
      if (t === 'applications') { const r = await api.get('/operator/applications?status=PENDING'); setApplications(r.data.data); }
      if (t === 'submissions') { const r = await api.get('/submissions/pending'); setSubmissions(r.data.data); }
      if (t === 'payouts') { const r = await api.get('/operator/payouts?status=PENDING'); setPayouts(r.data.data); }
      if (t === 'users') { const r = await api.get('/operator/users'); setUsers(r.data.data); }
      if (t === 'register-mission') { const r = await api.get('/operator/clients'); setClients(r.data.data); }
    } finally { setLoading(false); }
  }, []);

  async function updateMissionStatus(id: string, status: string) {
    await api.patch(`/operator/missions/${id}/status`, { status });
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }

  async function reviewApplication(id: string, status: 'APPROVED' | 'REJECTED') {
    const reason = status === 'REJECTED' ? prompt('반려 사유') : undefined;
    await api.patch(`/operator/applications/${id}`, { status, rejectionReason: reason });
    setApplications(prev => prev.filter(a => a.id !== id));
    loadStats();
  }

  async function reviewSubmission(id: string, status: 'APPROVED' | 'REJECTED' | 'REVISION', reason?: string) {
    // 사유는 카드에서 받아 온다 (prompt는 화면을 멈춰서 쓰지 않는다)
    try {
      await api.patch(`/submissions/${id}/review`, {
        status,
        rejectionReason: reason || undefined,
        // 수정 요청은 체험단원이 '무엇을 고칠지'로 읽으므로 검수 메모에도 같이 남긴다
        reviewNote: status === 'REVISION' ? reason || undefined : undefined,
      });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      loadStats();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '처리에 실패했습니다');
    }
  }

  /** 계좌번호 전체 보기 — 서버가 AuditLog에 기록한다 */
  async function revealAccount(id: string) {
    try {
      const { data } = await api.get(`/operator/payouts/${id}/account`);
      setPayouts(prev => prev.map(p => (p.id === id ? { ...p, ...data.data, revealed: true } : p)));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '계좌를 불러오지 못했습니다');
    }
  }

  async function processPayout(id: string) {
    try {
      await api.patch(`/operator/payouts/${id}`, { status: 'COMPLETED' });
      setPayouts(prev => prev.filter(p => p.id !== id));
      loadStats();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '지급 완료로 바꾸지 못했습니다');
    }
  }

  /** 번호 전체는 목록이 아니라 상세에서만 받는다 */
  async function openUserDetail(id: string) {
    try {
      const { data } = await api.get(`/operator/users/${id}`);
      setUserDetail(data.data);
    } catch { alert('회원 정보를 불러오지 못했습니다'); }
  }

  async function toggleUserActive(id: string, current: boolean) {
    await api.patch(`/operator/users/${id}/active`, { isActive: !current });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: !current } : u));
  }

  async function handleRegisterMission(e: React.FormEvent) {
    e.preventDefault();

    const dateError = missionDateError(registerForm);
    if (dateError) { alert(dateError); return; }

    setRegisterSubmitting(true);
    try {
      const { sendPaymentLink, ...missionData } = registerForm;
      const { data: createdRes } = await api.post('/missions', {
        ...missionData,
        rewardAmount: Number(missionData.rewardAmount),
        maxParticipants: Number(missionData.maxParticipants),
        sendPaymentLink,
      });
      // 등록 화면에서 고른 사진을 만들어진 미션에 올린다 (실패해도 미션은 남는다)
      const createdId = createdRes?.data?.id;
      if (pendingImages.length > 0 && createdId) {
        await uploadPendingImages(createdId, pendingImages)
          .catch(() => alert('미션은 등록됐지만 사진을 올리지 못했습니다. 미션 관리에서 다시 올려 주세요.'));
        setPendingImages([]);
      }
      const msg = sendPaymentLink
        ? '미션이 등록됐습니다. 고객사에게 결제 링크를 발송했습니다.'
        : '미션이 등록됐습니다 (결제 면제).';
      alert(msg);
      setRegisterForm({
        clientProfileId: '', title: '', description: '', category: 'SNS',
        rewardAmount: '', maxParticipants: '5', regionSi: '', regionGu: '',
        regionDong: '', visitAddress: '',
        startDate: '', endDate: '', submissionDeadline: '', requirements: '', visitGuide: '',
        businessCategory: '', momTags: [] as string[], visitHours: '', announceDate: '',
        sendPaymentLink: false,
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '등록에 실패했습니다');
    } finally { setRegisterSubmitting(false); }
  }

  const rf = (k: keyof typeof registerForm, v: string | boolean | string[]) =>
    setRegisterForm(prev => ({ ...prev, [k]: v }));

  if (!user) return null;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'overview', label: '개요' },
    { key: 'missions', label: '미션 관리' },
    { key: 'register-mission', label: '미션 대행 등록' },
    { key: 'applications', label: '지원서 승인', badge: stats?.pendingApplications },
    { key: 'submissions', label: '콘텐츠 검수', badge: stats?.pendingSubmissions },
    { key: 'payouts', label: '정산 처리', badge: stats?.pendingPayouts },
    { key: 'users', label: '회원 관리' },
    { key: 'traffic', label: '유입 성과' },
    { key: 'settings', label: '운영 설정' },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* 1024px 미만: 메뉴가 위로 올라가 가로 스크롤 탭이 된다 */}
      <div className="border-b border-line bg-paper lg:hidden">
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="flex flex-col">
            <span className="font-accent text-[11px] italic tracking-[0.08em] text-muted">Operator</span>
            <span className="font-serif text-section font-bold">맘브릿지</span>
          </span>
          <button
            type="button" aria-label="로그아웃"
            onClick={() => { clearAuth(); router.push('/login'); }}
            className="flex h-11 w-11 items-center justify-center text-muted"
          >
            <LogOutIcon size={20} />
          </button>
        </div>
        <div className="no-scrollbar overflow-x-auto px-5">
          <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.key} onClick={() => loadTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap py-3 pr-5 text-sm ${tab === t.key ? 'border-b-2 border-ink font-bold text-ink' : 'text-muted'}`}>
              {t.label}
              {!!t.badge && <span className="text-xs font-bold text-clay">{t.badge}</span>}
            </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 왼쪽 메뉴 (1024px 이상) */}
        <aside className="hidden min-h-screen w-[232px] shrink-0 flex-col border-r border-line bg-paper py-5 lg:flex">
          <div className="px-5 pb-5">
            <span className="font-accent text-[13px] italic tracking-[0.08em] text-muted">Operator</span>
            <p className="font-serif text-[22px] font-bold tracking-[-0.02em]">맘브릿지</p>
          </div>
          <nav aria-label="관리 메뉴" className="flex-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => loadTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`flex w-full items-center justify-between px-5 py-3 text-sm ${tab === t.key ? 'bg-ink font-medium text-paper' : 'text-ink-2'}`}>
                {t.label}
                {!!t.badge && (
                  <span className={`text-xs font-bold ${tab === t.key ? 'text-paper' : 'text-clay'}`}>{t.badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="space-y-1 border-t border-line-soft px-3 pt-3">
            <p className="px-2 pb-1 text-xs text-muted">미리보기</p>
            <Link href="/participant" className="block rounded-control px-3 py-2 text-sm text-ink-2">참여자 화면</Link>
            <Link href="/client" className="block rounded-control px-3 py-2 text-sm text-ink-2">고객사 화면</Link>
            <button
              type="button"
              onClick={() => { clearAuth(); router.push('/login'); }}
              className="block w-full rounded-control px-3 py-2 text-left text-sm text-muted"
            >
              로그아웃
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-3 sm:p-6 min-w-0">
          {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" /></div>}

          {/* 개요 */}
          {tab === 'overview' && stats && (
            <div className="space-y-6">
              <h2 className="font-serif text-[28px] font-bold tracking-[-0.02em]">오늘 처리할 일</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  { label: '지원서 대기', value: stats.pendingApplications, urgent: true },
                  { label: '검수 대기', value: stats.pendingSubmissions, urgent: true },
                  { label: '정산 대기', value: stats.pendingPayouts, urgent: true },
                  { label: '전체 미션', value: stats.totalMissions, urgent: false },
                  { label: '전체 회원', value: stats.totalUsers, urgent: false },
                ].map(item => {
                  // 처리할 것이 남은 카드만 ink로 눈에 띄게 (문서 3번)
                  const on = item.urgent && Number(item.value) > 0;
                  return (
                    <div key={item.label}
                      className={`rounded-card border p-5 ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper'}`}>
                      <p className={`text-[13px] ${on ? 'text-[#CFC4B4]' : 'text-muted'}`}>{item.label}</p>
                      <p className="mt-1 font-serif text-[28px] font-bold">{item.value}</p>
                    </div>
                  );
                })}
              </div>
              {/* 검수 대기 — 가장 먼저 처리해야 할 일이므로 위에 둔다 */}
              <section className="rounded-box border border-line bg-paper">
                <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
                  <h3 className="font-serif text-section-sm font-bold">검수 대기</h3>
                  <button onClick={() => loadTab('submissions')} className="text-[13px] text-muted">전체보기</button>
                </div>
                {submissions.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted">검수할 콘텐츠가 없습니다</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-line-soft text-xs text-muted">
                          <th className="px-5 py-2.5 font-medium">미션</th>
                          <th className="px-5 py-2.5 font-medium">참여자</th>
                          <th className="whitespace-nowrap px-5 py-2.5 font-medium">제출일</th>
                          <th className="whitespace-nowrap px-5 py-2.5 font-medium">대가 표시</th>
                          <th className="px-5 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.slice(0, 5).map(sb => {
                          const d = sb.disclosureCheck;
                          const ok = d === 'AUTO_PASSED' || d === 'MANUAL_CONFIRMED';
                          return (
                            <tr key={sb.id} className="border-b border-line-soft last:border-0">
                              <td className="max-w-[220px] truncate px-5 py-3">{sb.mission?.title}</td>
                              <td className="whitespace-nowrap px-5 py-3 text-ink-2">{sb.participant?.user?.name}</td>
                              <td className="px-5 py-3 text-muted"><ShortDate value={sb.submittedAt} /></td>
                              <td className="whitespace-nowrap px-5 py-3">
                                <span className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs ${ok ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay-dark'}`}>
                                  {ok ? '확인됨' : '확인 필요'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-right">
                                <button onClick={() => loadTab('submissions')} className="rounded-control border border-line px-3 py-1.5 text-[13px] text-ink-2">
                                  검수하기
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 미션 상태 — 가로 막대 하나에 비율로, 아래에 범례 */}
              {stats.missionsByStatus && (() => {
                const rows = (stats.missionsByStatus as any[]).filter(r => r._count > 0);
                const total = rows.reduce((n, r) => n + r._count, 0) || 1;
                return (
                  <section className="rounded-box border border-line bg-paper p-5">
                    <h3 className="mb-3.5 font-serif text-section-sm font-bold">미션 상태</h3>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      {rows.map(r => (
                        <span
                          key={r.status}
                          style={{ width: `${(r._count / total) * 100}%` }}
                          className={MISSION_STATUS_BAR[r.status] ?? 'bg-line'}
                        />
                      ))}
                    </div>
                    <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
                      {rows.map(r => (
                        <li key={r.status} className="flex items-center gap-1.5 text-[13px] text-ink-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${MISSION_STATUS_BAR[r.status] ?? 'bg-line'}`} />
                          {MISSION_STATUS_LABEL[r.status] ?? r.status}
                          <b className="font-medium">{r._count}건</b>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })()}

              {/* 정산 대기 */}
              <section className="flex items-center justify-between gap-4 rounded-box border border-line bg-paper p-5">
                <div>
                  <p className="text-[13px] text-muted">정산 대기</p>
                  <p className="mt-1 font-serif text-[28px] font-bold">
                    {payouts.reduce((sum, x) => sum + Number(x.netAmount ?? 0), 0).toLocaleString()}원
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{payouts.length}건 · 수수료·세금 공제 후</p>
                </div>
                <button
                  onClick={() => loadTab('payouts')}
                  className="flex h-11 shrink-0 items-center rounded-control border border-ink px-4 text-sm font-medium text-ink"
                >
                  정산 처리로 이동
                </button>
              </section>
            </div>
          )}

          {/* 미션 관리 */}
          {tab === 'missions' && !loading && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-ink">미션 관리 ({missions.length}건)</h2>

              {/* 1024px 미만 — 카드 목록 */}
              <CardList>
                {missions.map(m => (
                  <CardRow key={m.id}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-ink">{m.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{m.clientProfile?.businessName}</p>
                      </div>
                      <StatusBadge className={MISSION_STATUS_COLOR[m.status] ?? 'bg-cream text-ink-2'}>
                        {MISSION_STATUS_LABEL[m.status] ?? m.status}
                      </StatusBadge>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="whitespace-nowrap">지원 {m._count?.applications}건</span>
                      <span className="whitespace-nowrap">제출 {m._count?.submissions}건</span>
                      <Won value={m.rewardAmount} className="font-medium text-ink-2" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <QuietButton onClick={() => setEditMissionId(m.id)}>수정</QuietButton>
                      <QuietButton onClick={() => setPhotoMissionId(m.id)}>사진</QuietButton>
                      <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                        aria-label="미션 상태"
                        className="h-9 rounded-control border border-line bg-paper px-2 text-xs text-ink-2">
                        {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(st => (
                          <option key={st} value={st}>{MISSION_STATUS_LABEL[st]}</option>
                        ))}
                      </select>
                    </div>
                  </CardRow>
                ))}
                {missions.length === 0 && <EmptyRow>미션이 없습니다</EmptyRow>}
              </CardList>

              {/* 1024px 이상 — 표 */}
              <TableBox>
                <table className="w-full min-w-[860px] text-sm">
                  <TableHead columns={['미션명', '고객사', '상태', '지원', '제출', '보상', '작업']} />
                  <tbody className="divide-y divide-line">
                    {missions.map(m => (
                      <tr key={m.id} className="hover:bg-cream">
                        <td className="max-w-xs truncate px-4 py-3 font-medium text-ink" title={m.title}>{m.title}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{m.clientProfile?.businessName}</td>
                        <td className="px-4 py-3">
                          <StatusBadge className={MISSION_STATUS_COLOR[m.status] ?? 'bg-cream text-ink-2'}>
                            {MISSION_STATUS_LABEL[m.status] ?? m.status}
                          </StatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{m._count?.applications}건</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{m._count?.submissions}건</td>
                        <td className="px-4 py-3"><Won value={m.rewardAmount} className="font-medium text-ink" /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <QuietButton onClick={() => setEditMissionId(m.id)}>수정</QuietButton>
                            <QuietButton onClick={() => setPhotoMissionId(m.id)}>사진</QuietButton>
                            <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                              aria-label="미션 상태"
                              className="h-9 rounded-control border border-line bg-paper px-2 text-xs text-ink-2">
                              {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(st => (
                                <option key={st} value={st}>{MISSION_STATUS_LABEL[st]}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {missions.length === 0 && <div className="py-12 text-center text-muted">미션이 없습니다</div>}
              </TableBox>
            </div>
          )}

          {/* 지원서 승인 */}
          {tab === 'applications' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-ink mb-4">지원서 승인 대기 ({applications.length}건)</h2>
              <div className="space-y-3">
                {applications.map(a => (
                  <div key={a.id} className="bg-paper rounded-box p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-ink">{a.mission?.title}</p>
                        <p className="text-sm text-muted mt-1">{a.participant?.user?.name} ({a.participant?.user?.email})</p>
                        {a.message && <p className="text-sm text-ink-2 mt-2 bg-cream rounded-control p-2">{a.message}</p>}
                      </div>
                      <span className="text-sm font-bold text-ink-2">{Number(a.mission?.rewardAmount).toLocaleString()}원</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <PrimaryButton onClick={() => reviewApplication(a.id, 'APPROVED')}>승인</PrimaryButton>
                      <DangerButton confirmLabel="반려할까요?" onConfirm={() => reviewApplication(a.id, 'REJECTED')}>
                        반려
                      </DangerButton>
                    </div>
                  </div>
                ))}
                {applications.length === 0 && <div className="text-center py-12 text-muted bg-paper rounded-box">대기 중인 지원서가 없습니다</div>}
              </div>
            </div>
          )}

          {/* 콘텐츠 검수 */}
          {tab === 'submissions' && !loading && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-ink">콘텐츠 검수 대기 ({submissions.length}건)</h2>
              <div className="space-y-3">
                {submissions.map(s => (
                  <SubmissionReviewCard
                    key={s.id}
                    submission={s}
                    onChange={u => setSubmissions(prev => prev.map(x => (x.id === u.id ? { ...x, ...u } : x)))}
                    onReview={reviewSubmission}
                  />
                ))}
                {submissions.length === 0 && <EmptyRow>대기 중인 제출물이 없습니다</EmptyRow>}
              </div>
            </div>
          )}

          {tab === 'traffic' && <TrafficSummary />}
          {tab === 'settings' && <SettingsEditor />}

          {/* 정산 처리 */}
          {tab === 'payouts' && !loading && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-ink">정산 대기 ({payouts.length}건)</h2>

              <CardList>
                {payouts.map(p => (
                  <CardRow key={p.id}>
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-ink">{p.participant?.user?.name}</p>
                      <p className="text-xs text-muted">{p.participant?.user?.email}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted">{p.submission?.mission?.title}</p>
                    </div>
                    <div className="mb-3 rounded-control border border-line bg-cream px-3 py-2">
                      <PayoutAccount payout={p} onReveal={revealAccount} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm">
                        <Won value={p.amount} className="text-muted line-through" />
                        <Won value={p.netAmount} className="font-bold text-sage" />
                      </div>
                      <PrimaryButton
                        onClick={() => processPayout(p.id)}
                        disabled={!p.hasAccount}
                        title={p.hasAccount ? undefined : '계좌가 등록되어야 지급 완료로 바꿀 수 있습니다'}
                      >
                        지급 완료 처리
                      </PrimaryButton>
                    </div>
                  </CardRow>
                ))}
                {payouts.length === 0 && <EmptyRow>대기 중인 정산이 없습니다</EmptyRow>}
              </CardList>

              <TableBox>
                <table className="w-full min-w-[1000px] text-sm">
                  <TableHead columns={['참여자', '미션', '입금 계좌', '지급액', '수수료', '실지급', '작업']} />
                  <tbody className="divide-y divide-line">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-cream">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium text-ink">{p.participant?.user?.name}</p>
                          <p className="text-xs text-muted">{p.participant?.user?.email}</p>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-ink-2" title={p.submission?.mission?.title}>
                          {p.submission?.mission?.title}
                        </td>
                        <td className="px-4 py-3"><PayoutAccount payout={p} onReveal={revealAccount} /></td>
                        <td className="px-4 py-3"><Won value={p.amount} className="font-medium" /></td>
                        <td className="px-4 py-3 text-clay-dark"><Won value={p.platformFee} /></td>
                        <td className="px-4 py-3"><Won value={p.netAmount} className="font-bold text-sage" /></td>
                        <td className="px-4 py-3">
                          <PrimaryButton
                            onClick={() => processPayout(p.id)}
                            disabled={!p.hasAccount}
                            title={p.hasAccount ? '지급 완료로 바꿉니다' : '계좌가 등록되어야 지급 완료로 바꿀 수 있습니다'}
                          >
                            지급 완료
                          </PrimaryButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payouts.length === 0 && <div className="py-12 text-center text-muted">대기 중인 정산이 없습니다</div>}
              </TableBox>
            </div>
          )}

          {/* 미션 대행 등록 */}
          {tab === 'register-mission' && !loading && (
            <div>
              <h2 className="mb-2 text-xl font-bold text-ink">고객사 대신 미션 등록</h2>
              <p className="mb-6 text-sm text-muted">고객사를 고르고 미션을 대신 등록합니다.</p>
              <RegisterMissionForm
                form={registerForm}
                set={rf}
                clients={clients}
                pendingImages={pendingImages}
                onPendingChange={setPendingImages}
                submitting={registerSubmitting}
                onSubmit={handleRegisterMission}
              />
            </div>
          )}

          {/* 회원 관리 */}
          {tab === 'users' && !loading && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-ink">회원 관리 ({users.length}명)</h2>

              <CardList>
                {users.map(u => (
                  <CardRow key={u.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => openUserDetail(u.id)} className="text-left">
                          <p className="text-sm font-semibold text-ink underline-offset-2 hover:underline">{u.name}</p>
                        </button>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                        <p className="whitespace-nowrap text-xs text-muted">{u.phone ?? '번호 없음'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusBadge>{ROLE_LABEL[u.role] ?? u.role}</StatusBadge>
                          <StatusBadge className={u.isActive ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay-dark'}>
                            {u.isActive ? '활성' : '비활성'}
                          </StatusBadge>
                        </div>
                      </div>
                      {u.id !== user.id && (
                        u.isActive
                          ? (
                            <DangerButton confirmLabel="비활성화할까요?" onConfirm={() => toggleUserActive(u.id, u.isActive)}>
                              비활성화
                            </DangerButton>
                          )
                          : <PrimaryButton onClick={() => toggleUserActive(u.id, u.isActive)}>활성화</PrimaryButton>
                      )}
                    </div>
                  </CardRow>
                ))}
                {users.length === 0 && <EmptyRow>회원이 없습니다</EmptyRow>}
              </CardList>

              <TableBox>
                <table className="w-full min-w-[900px] text-sm">
                  <TableHead columns={['이름', '이메일', '휴대폰', '역할', '상태', '가입일', '최근 로그인', '작업']} />
                  <tbody className="divide-y divide-line">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-cream">
                        <td className="whitespace-nowrap px-4 py-3">
                          <button type="button" onClick={() => openUserDetail(u.id)}
                            className="font-medium text-ink underline-offset-2 hover:underline">{u.name}</button>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-muted" title={u.email}>{u.email}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{u.phone ?? '-'}</td>
                        <td className="px-4 py-3"><StatusBadge>{ROLE_LABEL[u.role] ?? u.role}</StatusBadge></td>
                        <td className="px-4 py-3">
                          <StatusBadge className={u.isActive ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay-dark'}>
                            {u.isActive ? '활성' : '비활성'}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-muted"><ShortDate value={u.createdAt} /></td>
                        <td className="px-4 py-3 text-muted"><ShortDate value={u.lastLoginAt} /></td>
                        <td className="px-4 py-3">
                          {u.id !== user.id && (
                            u.isActive
                              ? (
                                <DangerButton confirmLabel="비활성화할까요?" onConfirm={() => toggleUserActive(u.id, u.isActive)}>
                                  비활성화
                                </DangerButton>
                              )
                              : <PrimaryButton onClick={() => toggleUserActive(u.id, u.isActive)}>활성화</PrimaryButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <div className="py-12 text-center text-muted">회원이 없습니다</div>}
              </TableBox>
            </div>
          )}
        </main>
      </div>

      {/* 사진 관리 — 미션 수정 화면이 아직 없어, 기존 미션의 사진만 여기서 바꾼다 */}
      {photoMissionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-lg rounded-box bg-paper p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-section-sm font-bold">사진 관리</h2>
              <button onClick={() => setPhotoMissionId(null)} aria-label="닫기" className="h-11 w-11 text-xl text-muted">×</button>
            </div>
            <MissionImageUploader missionId={photoMissionId} />
            <button onClick={() => { setPhotoMissionId(null); void loadTab('missions'); }}
              className="mt-4 h-11 w-full rounded-control bg-ink text-sm font-bold text-paper">완료</button>
          </div>
        </div>
      )}

      {/* 미션 수정 */}
      {editMissionId && (
        <MissionEditModal
          missionId={editMissionId}
          onClose={() => setEditMissionId(null)}
          onSaved={() => void loadTab('missions')}
        />
      )}

      {/* 회원 상세 — 휴대폰 번호 전체는 여기서만 보여준다 */}
      {userDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-box bg-paper p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-section-sm font-bold">{userDetail.name}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{userDetail.email}</p>
              </div>
              <button onClick={() => setUserDetail(null)} aria-label="닫기" className="shrink-0 text-xl text-muted">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['역할', ROLE_LABEL[userDetail.role] ?? userDetail.role],
                ['휴대폰', userDetail.phone ?? '등록 없음'],
                ['문자 인증', userDetail.phoneVerifiedAt ? new Date(userDetail.phoneVerifiedAt).toLocaleDateString('ko-KR') : '안 함'],
                ['상태', userDetail.isActive ? '활성' : '비활성'],
                ['가입일', new Date(userDetail.createdAt).toLocaleDateString('ko-KR')],
                ['최근 로그인', userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleDateString('ko-KR') : '-'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <button onClick={() => setUserDetail(null)}
              className="mt-5 h-12 w-full rounded-control bg-ink text-sm font-bold text-paper">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
