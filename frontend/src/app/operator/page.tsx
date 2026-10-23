'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { LogOutIcon } from '@/components/ui/icons';
import MissionImageUploader, { uploadPendingImages, type PendingImage } from '@/components/missions/MissionImageUploader';
import { BUSINESS_CATEGORIES, MOM_TAGS } from '@/lib/mission-options';
import { SettingsEditor, SubmissionCheckPanel, TrafficSummary } from '@/components/operator/OperatorCampaignTools';
import ProvinceSelect from '@/components/common/ProvinceSelect';

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
  const [registerForm, setRegisterForm] = useState({
    clientProfileId: '', title: '', description: '', category: 'SNS',
    rewardAmount: '', maxParticipants: '5', regionSi: '', regionGu: '',
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

  async function reviewSubmission(id: string, status: 'APPROVED' | 'REJECTED' | 'REVISION') {
    const reason = status === 'REJECTED' ? prompt('반려 사유') : undefined;
    const note = status === 'REVISION' ? prompt('수정 요청 내용 (예: 제목에 [광고]를 넣어 주세요)') : undefined;
    try {
      await api.patch(`/submissions/${id}/review`, { status, rejectionReason: reason ?? undefined, reviewNote: note ?? undefined });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      loadStats();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '처리에 실패했습니다');
    }
  }

  async function processPayout(id: string) {
    await api.patch(`/operator/payouts/${id}`, { status: 'COMPLETED' });
    setPayouts(prev => prev.filter(p => p.id !== id));
    loadStats();
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
                              <td className="whitespace-nowrap px-5 py-3 text-muted">
                                {sb.submittedAt ? new Date(sb.submittedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}
                              </td>
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
              <h2 className="text-xl font-bold text-ink mb-4">미션 관리 ({missions.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {missions.map(m => (
                  <div key={m.id} className="bg-paper rounded-card border p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm line-clamp-2">{m.title}</p>
                        <p className="text-xs text-muted mt-0.5">{m.clientProfile?.businessName}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${MISSION_STATUS_COLOR[m.status] ?? 'bg-cream'}`}>
                        {MISSION_STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted space-x-2">
                        <span>지원 {m._count?.applications}건</span>
                        <span>제출 {m._count?.submissions}건</span>
                        <span className="text-ink-2 font-medium">{Number(m.rewardAmount).toLocaleString()}원</span>
                      </div>
                      <button type="button" onClick={() => setPhotoMissionId(m.id)}
                        className="rounded-control border border-line px-2 py-1 text-xs text-ink-2">사진 관리</button>
                      <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1 text-ink-2">
                        {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(s => (
                          <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {missions.length === 0 && <div className="text-center py-12 text-muted bg-paper rounded-box">미션이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-paper rounded-box overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-cream border-b">
                      <tr>{['미션명', '고객사', '상태', '지원/제출', '보상', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-ink-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {missions.map(m => (
                        <tr key={m.id} className="hover:bg-cream">
                          <td className="px-4 py-3 font-medium text-ink max-w-xs truncate">{m.title}</td>
                          <td className="px-4 py-3 text-muted">{m.clientProfile?.businessName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${MISSION_STATUS_COLOR[m.status] ?? 'bg-cream'}`}>
                              {MISSION_STATUS_LABEL[m.status] ?? m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{m._count?.applications} / {m._count?.submissions}</td>
                          <td className="px-4 py-3 text-ink font-medium">{Number(m.rewardAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                              className="text-xs border rounded px-2 py-1 text-ink-2">
                              {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(s => (
                                <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {missions.length === 0 && <div className="text-center py-12 text-muted">미션이 없습니다</div>}
                </div>
              </div>
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
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => reviewApplication(a.id, 'APPROVED')} className="px-4 py-2 bg-sage text-paper text-sm rounded-control hover:bg-sage">승인</button>
                      <button onClick={() => reviewApplication(a.id, 'REJECTED')} className="px-4 py-2 bg-clay text-paper text-sm rounded-control hover:bg-clay-dark">반려</button>
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
              <h2 className="text-xl font-bold text-ink mb-4">콘텐츠 검수 대기 ({submissions.length}건)</h2>
              <div className="space-y-3">
                {submissions.map(s => (
                  <div key={s.id} className="bg-paper rounded-box p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-ink">{s.mission?.title}</p>
                        <p className="text-sm text-muted">{s.participant?.user?.name} ({s.participant?.user?.email})</p>
                      </div>
                      <span className="text-xs text-muted">{new Date(s.submittedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    {s.description && <p className="text-sm text-ink-2 bg-cream rounded-control p-3 mb-3">{s.description}</p>}
                    {s.snsPostUrl && <a href={s.snsPostUrl} target="_blank" rel="noreferrer" className="text-xs text-clay underline block mb-3">SNS 링크 보기 →</a>}
                    <SubmissionCheckPanel submission={s} onConfirmed={u => setSubmissions(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x))} />
                    {s.mediaUrls?.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {s.mediaUrls.map((url: string, i: number) => <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs bg-cream text-ink-2 px-2 py-1 rounded">첨부 {i + 1}</a>)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => reviewSubmission(s.id, 'APPROVED')}
                        disabled={s.mission?.category === 'REVIEW' && !['AUTO_PASSED', 'MANUAL_CONFIRMED'].includes(s.disclosureCheck)}
                        title={s.mission?.category === 'REVIEW' && !['AUTO_PASSED', 'MANUAL_CONFIRMED'].includes(s.disclosureCheck) ? '대가 표시 확인 후 승인할 수 있습니다' : undefined}
                        className="px-4 py-2 bg-sage text-paper text-sm rounded-control hover:bg-sage disabled:opacity-40 disabled:cursor-not-allowed">승인 (정산 생성)</button>
                      <button onClick={() => reviewSubmission(s.id, 'REVISION')} className="px-4 py-2 border border-clay text-clay-dark text-sm rounded-control hover:bg-clay-tint">수정 요청</button>
                      <button onClick={() => reviewSubmission(s.id, 'REJECTED')} className="px-4 py-2 bg-clay text-paper text-sm rounded-control hover:bg-clay-dark">반려</button>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && <div className="text-center py-12 text-muted bg-paper rounded-box">대기 중인 제출물이 없습니다</div>}
              </div>
            </div>
          )}

          {tab === 'traffic' && <TrafficSummary />}
          {tab === 'settings' && <SettingsEditor />}

          {/* 정산 처리 */}
          {tab === 'payouts' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-ink mb-4">정산 대기 ({payouts.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {payouts.map(p => (
                  <div key={p.id} className="bg-paper rounded-card border p-4">
                    <div className="mb-2">
                      <p className="font-semibold text-ink text-sm">{p.participant?.user?.name}</p>
                      <p className="text-xs text-muted">{p.participant?.user?.email}</p>
                      <p className="text-xs text-muted mt-1 line-clamp-1">{p.submission?.mission?.title}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm space-x-2">
                        <span className="text-muted line-through">{Number(p.amount).toLocaleString()}원</span>
                        <span className="font-bold text-sage">{Number(p.netAmount).toLocaleString()}원</span>
                      </div>
                      <button onClick={() => processPayout(p.id)} className="px-3 py-1.5 bg-ink text-paper text-xs rounded-control">지급 완료</button>
                    </div>
                  </div>
                ))}
                {payouts.length === 0 && <div className="text-center py-12 text-muted bg-paper rounded-box">대기 중인 정산이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-paper rounded-box overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-cream border-b">
                      <tr>{['참여자', '미션', '지급액', '수수료', '실지급', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-ink-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {payouts.map(p => (
                        <tr key={p.id} className="hover:bg-cream">
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{p.participant?.user?.name}</p>
                            <p className="text-xs text-muted">{p.participant?.user?.email}</p>
                          </td>
                          <td className="px-4 py-3 text-ink-2 max-w-xs truncate">{p.submission?.mission?.title}</td>
                          <td className="px-4 py-3 font-medium">{Number(p.amount).toLocaleString()}원</td>
                          <td className="px-4 py-3 text-clay-dark">-{Number(p.platformFee).toLocaleString()}원</td>
                          <td className="px-4 py-3 font-bold text-sage">{Number(p.netAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <button onClick={() => processPayout(p.id)} className="px-3 py-1.5 bg-ink text-paper text-xs rounded-control">지급 완료 처리</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payouts.length === 0 && <div className="text-center py-12 text-muted">대기 중인 정산이 없습니다</div>}
                </div>
              </div>
            </div>
          )}

          {/* 미션 대행 등록 */}
          {tab === 'register-mission' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-ink mb-2">고객사 대신 미션 등록</h2>
              <p className="text-sm text-muted mb-6">고객사를 선택하고 미션을 대신 등록합니다. 결제 링크를 발송하면 고객사에게 SMS/카카오톡으로 전송됩니다.</p>
              <div className="bg-paper rounded-box p-6">
                <form onSubmit={handleRegisterMission} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">고객사 선택 *</label>
                    <select required className="w-full border rounded-control px-3 py-2 text-sm"
                      value={registerForm.clientProfileId} onChange={e => rf('clientProfileId', e.target.value)}>
                      <option value="">고객사를 선택하세요</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.businessName} ({c.user?.email}){c.contactPhone ? ` · ${c.contactPhone}` : ' · 연락처 없음'}
                        </option>
                      ))}
                    </select>
                    {clients.length === 0 && <p className="text-xs text-clay-dark mt-1">등록된 고객사가 없습니다. 먼저 CLIENT 계정을 만들어야 합니다.</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">미션 제목 *</label>
                    <input required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                      value={registerForm.title} onChange={e => rf('title', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">미션 설명 *</label>
                    <textarea required rows={3} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                      value={registerForm.description} onChange={e => rf('description', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">미션 유형 *</label>
                      <select required className="w-full border rounded-control px-3 py-2 text-sm" value={registerForm.category} onChange={e => rf('category', e.target.value)}>
                        {[['SNS', 'SNS 게시'], ['VISIT', '방문 인증'], ['REVIEW', '리뷰 작성'], ['VIDEO', '영상 제작']].map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">1인 보상금액 (원) *</label>
                      <input required type="number" min="1000" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                        value={registerForm.rewardAmount} onChange={e => rf('rewardAmount', e.target.value)} placeholder="예: 30000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">모집 인원 *</label>
                      <input required type="number" min="1" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                        value={registerForm.maxParticipants} onChange={e => rf('maxParticipants', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1">지역 (시·도) *</label>
                      <ProvinceSelect required value={registerForm.regionSi} onChange={v => rf('regionSi', v)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">지역 (시·군·구) *</label>
                    <input required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                      value={registerForm.regionGu} onChange={e => rf('regionGu', e.target.value)} placeholder="예: 청주시 상당구, 마포구" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {([['startDate', '시작일 *'], ['endDate', '종료일 *'], ['submissionDeadline', '제출 마감일 *']] as const).map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-sm font-medium text-ink-2 mb-1">{l}</label>
                        <input required type="date" className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                          value={registerForm[k]} onChange={e => rf(k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">수행 조건 (선택)</label>
                    <textarea rows={2} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                      value={registerForm.requirements} onChange={e => rf('requirements', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-2 mb-1">방문·예약 안내 (선택)</label>
                    <textarea rows={3} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                      value={registerForm.visitGuide} onChange={e => rf('visitGuide', e.target.value)}
                      placeholder={'한 줄에 하나씩. 예: 체험 가능: 평일 11:30~20:30 / 당일 예약 불가'} />
                  </div>

                  <div className="rounded-card border border-line bg-cream p-4">
                    <MissionImageUploader pending={pendingImages} onPendingChange={setPendingImages} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="op-biz" className="mb-1 block text-sm font-medium text-ink-2">업종</label>
                      <select id="op-biz" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                        value={registerForm.businessCategory} onChange={e => rf('businessCategory', e.target.value)}>
                        <option value="">선택 안 함</option>
                        {BUSINESS_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="op-hours" className="mb-1 block text-sm font-medium text-ink-2">방문 가능 시간</label>
                      <input id="op-hours" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                        value={registerForm.visitHours} onChange={e => rf('visitHours', e.target.value)} placeholder="예: 평일 10:00~15:00" />
                    </div>
                  </div>

                  <div>
                    <span className="mb-1 block text-sm font-medium text-ink-2">엄마 시간 태그</span>
                    <div className="flex flex-wrap gap-2">
                      {MOM_TAGS.map(([v, l]) => {
                        const on = registerForm.momTags.includes(v);
                        return (
                          <button key={v} type="button" aria-pressed={on}
                            onClick={() => rf('momTags', on ? registerForm.momTags.filter(t => t !== v) : [...registerForm.momTags, v])}
                            className={`flex h-9 items-center rounded-full px-3.5 text-[13px] ${on ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'}`}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="op-announce" className="mb-1 block text-sm font-medium text-ink-2">선정 발표일</label>
                    <input id="op-announce" type="date" className="w-full rounded-control border border-line bg-paper px-3 py-2 text-sm"
                      value={registerForm.announceDate} onChange={e => rf('announceDate', e.target.value)} />
                  </div>

                  {/* 결제 옵션 */}
                  <div className="bg-cream rounded-card p-4 border">
                    <p className="text-sm font-medium text-ink-2 mb-3">결제 처리</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="radio" name="paymentOption" className="mt-0.5"
                          checked={!registerForm.sendPaymentLink}
                          onChange={() => rf('sendPaymentLink', false)} />
                        <div>
                          <p className="text-sm font-medium text-ink">결제 면제 (WAIVED)</p>
                          <p className="text-xs text-muted">운영자 테스트, 프로모션 등 결제 없이 바로 등록</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="radio" name="paymentOption" className="mt-0.5"
                          checked={registerForm.sendPaymentLink}
                          onChange={() => rf('sendPaymentLink', true)} />
                        <div>
                          <p className="text-sm font-medium text-ink">결제 링크 발송 (SMS/카카오톡)</p>
                          <p className="text-xs text-muted">
                            고객사 연락처로 결제 링크를 발송합니다.
                            {registerForm.clientProfileId && clients.find(c => c.id === registerForm.clientProfileId)?.contactPhone
                              ? ` 수신: ${clients.find(c => c.id === registerForm.clientProfileId)?.contactPhone}`
                              : ' (연락처가 없으면 발송되지 않습니다)'}
                          </p>
                        </div>
                      </label>
                    </div>
                    {registerForm.sendPaymentLink && registerForm.rewardAmount && registerForm.maxParticipants && (
                      <div className="mt-3 pt-3 border-t text-sm text-ink-2">
                        결제 요청 금액: <strong>{(Number(registerForm.rewardAmount) * Number(registerForm.maxParticipants)).toLocaleString()}원</strong>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={registerSubmitting}
                    className="w-full bg-ink text-paper rounded-card py-3 font-semibold disabled:opacity-50 transition-colors">
                    {registerSubmitting ? '등록 중...' : registerForm.sendPaymentLink ? '미션 등록 + 결제 링크 발송' : '미션 등록 (결제 면제)'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 회원 관리 */}
          {tab === 'users' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-ink mb-4">회원 관리 ({users.length}명)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {users.map(u => (
                  <div key={u.id} className="bg-paper rounded-card border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={() => openUserDetail(u.id)} className="text-left">
                          <p className="font-semibold text-ink text-sm underline-offset-2 hover:underline">{u.name}</p>
                        </button>
                        <p className="text-xs text-muted truncate">{u.email}</p>
                        <p className="text-xs text-muted">{u.phone ?? '번호 없음'}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 bg-cream text-ink-2 rounded-full text-xs">{ROLE_LABEL[u.role] ?? u.role}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay-dark'}`}>
                            {u.isActive ? '활성' : '비활성'}
                          </span>
                        </div>
                      </div>
                      {u.id !== user.id && (
                        <button onClick={() => toggleUserActive(u.id, u.isActive)}
                          className={`shrink-0 px-3 py-1.5 text-xs rounded-control text-paper ${u.isActive ? 'bg-clay' : 'bg-sage'}`}>
                          {u.isActive ? '비활성화' : '활성화'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="text-center py-12 text-muted bg-paper rounded-box">회원이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-paper rounded-box overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-cream border-b">
                      <tr>{['이름/이메일', '휴대폰', '역할', '상태', '가입일', '최근 로그인', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-ink-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-cream">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => openUserDetail(u.id)}
                              className="font-medium text-ink underline-offset-2 hover:underline">{u.name}</button>
                            <p className="text-xs text-muted">{u.email}</p>
                          </td>
                          <td className="px-4 py-3 text-muted">{u.phone ?? '-'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-cream text-ink-2 rounded-full text-xs">{ROLE_LABEL[u.role] ?? u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-sage-tint text-sage' : 'bg-clay-tint text-clay-dark'}`}>
                              {u.isActive ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                          <td className="px-4 py-3 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-4 py-3">
                            {u.id !== user.id && (
                              <button onClick={() => toggleUserActive(u.id, u.isActive)}
                                className={`px-3 py-1.5 text-xs rounded-control text-paper ${u.isActive ? 'bg-clay hover:bg-clay-dark' : 'bg-sage hover:bg-sage'}`}>
                                {u.isActive ? '비활성화' : '활성화'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && <div className="text-center py-12 text-muted">회원이 없습니다</div>}
                </div>
              </div>
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
