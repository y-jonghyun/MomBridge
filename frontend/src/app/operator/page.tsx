'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Tab = 'overview' | 'missions' | 'applications' | 'submissions' | 'payouts' | 'users' | 'register-mission';

const MISSION_STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료' };
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
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    clientProfileId: '', title: '', description: '', category: 'SNS',
    rewardAmount: '', maxParticipants: '5', regionSi: '', regionGu: '',
    startDate: '', endDate: '', submissionDeadline: '', requirements: '',
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

  async function reviewSubmission(id: string, status: 'APPROVED' | 'REJECTED') {
    const reason = status === 'REJECTED' ? prompt('반려 사유') : undefined;
    await api.patch(`/submissions/${id}/review`, { status, rejectionReason: reason });
    setSubmissions(prev => prev.filter(s => s.id !== id));
    loadStats();
  }

  async function processPayout(id: string) {
    await api.patch(`/operator/payouts/${id}`, { status: 'COMPLETED' });
    setPayouts(prev => prev.filter(p => p.id !== id));
    loadStats();
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
      await api.post('/missions', {
        ...missionData,
        rewardAmount: Number(missionData.rewardAmount),
        maxParticipants: Number(missionData.maxParticipants),
        sendPaymentLink,
      });
      const msg = sendPaymentLink
        ? '미션이 등록됐습니다. 고객사에게 결제 링크를 발송했습니다.'
        : '미션이 등록됐습니다 (결제 면제).';
      alert(msg);
      setRegisterForm({
        clientProfileId: '', title: '', description: '', category: 'SNS',
        rewardAmount: '', maxParticipants: '5', regionSi: '', regionGu: '',
        startDate: '', endDate: '', submissionDeadline: '', requirements: '',
        sendPaymentLink: false,
      });
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '등록에 실패했습니다');
    } finally { setRegisterSubmitting(false); }
  }

  const rf = (k: keyof typeof registerForm, v: string | boolean) =>
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
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* 헤더 */}
      <header className="bg-cream border-b border-line px-5 sm:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif italic text-lg">맘브릿지</Link>
          <span className="text-[11px] tracking-widest2 text-muted">운영자</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-muted">{user.name}</span>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-[11px] tracking-widest2 text-muted hover:text-ink">로그아웃</button>
        </div>
      </header>

      {/* 모바일 탭 (sm 미만) */}
      <div className="sm:hidden bg-cream border-b border-line overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.key} onClick={() => loadTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[11px] tracking-wide whitespace-nowrap border-b transition-colors ${tab === t.key ? 'border-ink text-ink' : 'border-transparent text-muted'}`}>
              {t.label}
              {!!t.badge && <span className="bg-ink text-cream text-[10px] rounded-full px-1.5 min-w-[18px] text-center">{t.badge}</span>}
            </button>
          ))}
          <div className="w-px bg-line my-2" />
          <Link href="/participant" className="flex items-center gap-1 px-4 py-3 text-[11px] tracking-wide whitespace-nowrap text-muted border-b border-transparent">
            참여자
          </Link>
          <Link href="/client" className="flex items-center gap-1 px-4 py-3 text-[11px] tracking-wide whitespace-nowrap text-muted border-b border-transparent">
            고객사
          </Link>
        </div>
      </div>

      <div className="flex">
        {/* 사이드바 (데스크탑만) */}
        <aside className="hidden sm:flex w-52 min-h-[calc(100vh-77px)] bg-cream border-r border-line py-6 flex-col">
          <div className="flex-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => loadTab(t.key)}
                className={`w-full flex items-center justify-between px-6 py-3 text-[12px] tracking-wide transition-colors ${tab === t.key ? 'bg-sand text-ink border-r-2 border-ink' : 'text-muted hover:bg-sand/50'}`}>
                {t.label}
                {!!t.badge && <span className="bg-ink text-cream text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{t.badge}</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-4 px-4 space-y-1">
            <p className="text-[11px] text-muted px-2 pb-1 tracking-widest2">미리보기</p>
            <Link href="/participant" className="block px-3 py-2 text-[12px] text-muted hover:text-ink">
              참여자 화면
            </Link>
            <Link href="/client" className="block px-3 py-2 text-[12px] text-muted hover:text-ink">
              고객사 화면
            </Link>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-5 sm:p-10 min-w-0">
          {loading && <div className="flex justify-center py-20"><div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" /></div>}

          {/* 개요 */}
          {tab === 'overview' && stats && (
            <div className="space-y-8">
              <h2 className="font-serif italic text-xl">대시보드 개요</h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-line border border-line">
                {[
                  { label: '전체 회원', value: stats.totalUsers },
                  { label: '전체 미션', value: stats.totalMissions },
                  { label: '지원서 대기', value: stats.pendingApplications },
                  { label: '검수 대기', value: stats.pendingSubmissions },
                  { label: '정산 대기', value: stats.pendingPayouts },
                ].map(item => (
                  <div key={item.label} className="bg-cream p-5">
                    <p className="text-[12px] text-muted mb-1">{item.label}</p>
                    <p className="text-2xl font-serif italic">{item.value}</p>
                  </div>
                ))}
              </div>
              {stats.missionsByStatus && (
                <div className="border border-line p-5">
                  <h3 className="text-[13px] tracking-widest2 text-muted mb-4">미션 상태별 현황</h3>
                  <div className="flex gap-3 flex-wrap">
                    {(stats.missionsByStatus as any[]).map(s => (
                      <div key={s.status} className="border border-line px-4 py-2 text-[12px]">
                        {MISSION_STATUS_LABEL[s.status] ?? s.status}: {s._count}건
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-px bg-line border border-line">
                {([['applications', '지원서 승인 처리'], ['submissions', '콘텐츠 검수'], ['payouts', '정산 처리']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => loadTab(key)}
                    className="bg-cream p-5 text-left hover:bg-sand/40 transition-colors">
                    <p className="text-[13px] mb-1">{label} →</p>
                    <p className="text-[11px] text-muted">대기 항목 처리하기</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 미션 관리 */}
          {tab === 'missions' && !loading && (
            <div>
              <h2 className="font-serif italic text-xl mb-6">미션 관리 ({missions.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {missions.map(m => (
                  <div key={m.id} className="border border-line p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] line-clamp-2">{m.title}</p>
                        <p className="text-[11px] text-muted mt-0.5">{m.clientProfile?.businessName}</p>
                      </div>
                      <span className="shrink-0 border border-line px-2 py-1 text-[11px] text-muted">
                        {MISSION_STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-muted space-x-2">
                        <span>지원 {m._count?.applications}건</span>
                        <span>제출 {m._count?.submissions}건</span>
                        <span className="text-ink">{Number(m.rewardAmount).toLocaleString()}원</span>
                      </div>
                      <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                        className="text-[11px] border border-line px-2 py-1 bg-cream">
                        {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(s => (
                          <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {missions.length === 0 && <div className="text-center py-12 text-muted border border-line">미션이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block border border-line overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[600px]">
                    <thead className="bg-sand border-b border-line">
                      <tr>{['미션명', '고객사', '상태', '지원/제출', '보상', '작업'].map(h => <th key={h} className="text-left px-4 py-3 text-[11px] tracking-wide text-muted font-normal">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {missions.map(m => (
                        <tr key={m.id} className="hover:bg-sand/40">
                          <td className="px-4 py-3 max-w-xs truncate">{m.title}</td>
                          <td className="px-4 py-3 text-muted">{m.clientProfile?.businessName}</td>
                          <td className="px-4 py-3">
                            <span className="border border-line px-2 py-1 text-[11px] text-muted">
                              {MISSION_STATUS_LABEL[m.status] ?? m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{m._count?.applications} / {m._count?.submissions}</td>
                          <td className="px-4 py-3">{Number(m.rewardAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                              className="text-[11px] border border-line px-2 py-1 bg-cream">
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
              <h2 className="font-serif italic text-xl mb-6">지원서 승인 대기 ({applications.length}건)</h2>
              <div className="space-y-4">
                {applications.map(a => (
                  <div key={a.id} className="border border-line p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[13px]">{a.mission?.title}</p>
                        <p className="text-[12px] text-muted mt-1">{a.participant?.user?.name} ({a.participant?.user?.email})</p>
                        {a.message && <p className="text-[12px] bg-sand p-2 mt-2">{a.message}</p>}
                      </div>
                      <span className="text-[13px] shrink-0">{Number(a.mission?.rewardAmount).toLocaleString()}원</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => reviewApplication(a.id, 'APPROVED')} className="btn-outline py-2 px-4 text-[11px]">승인</button>
                      <button onClick={() => reviewApplication(a.id, 'REJECTED')} className="border border-line text-muted hover:text-ink hover:border-ink py-2 px-4 text-[11px] tracking-widest2 transition-colors">반려</button>
                    </div>
                  </div>
                ))}
                {applications.length === 0 && <div className="text-center py-12 text-muted border border-line">대기 중인 지원서가 없습니다</div>}
              </div>
            </div>
          )}

          {/* 콘텐츠 검수 */}
          {tab === 'submissions' && !loading && (
            <div>
              <h2 className="font-serif italic text-xl mb-6">콘텐츠 검수 대기 ({submissions.length}건)</h2>
              <div className="space-y-4">
                {submissions.map(s => (
                  <div key={s.id} className="border border-line p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[13px]">{s.mission?.title}</p>
                        <p className="text-[12px] text-muted">{s.participant?.user?.name} ({s.participant?.user?.email})</p>
                      </div>
                      <span className="text-[11px] text-muted">{new Date(s.submittedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    {s.description && <p className="text-[12px] bg-sand p-3 mb-3">{s.description}</p>}
                    {s.snsPostUrl && <a href={s.snsPostUrl} target="_blank" rel="noreferrer" className="text-[11px] text-ink underline block mb-3">SNS 링크 보기 →</a>}
                    {s.mediaUrls?.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {s.mediaUrls.map((url: string, i: number) => <a key={i} href={url} target="_blank" rel="noreferrer" className="text-[11px] border border-line px-2 py-1 text-muted">첨부 {i + 1}</a>)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => reviewSubmission(s.id, 'APPROVED')} className="btn-outline py-2 px-4 text-[11px]">승인 (정산 생성)</button>
                      <button onClick={() => reviewSubmission(s.id, 'REJECTED')} className="border border-line text-muted hover:text-ink hover:border-ink py-2 px-4 text-[11px] tracking-widest2 transition-colors">반려</button>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && <div className="text-center py-12 text-muted border border-line">대기 중인 제출물이 없습니다</div>}
              </div>
            </div>
          )}

          {/* 정산 처리 */}
          {tab === 'payouts' && !loading && (
            <div>
              <h2 className="font-serif italic text-xl mb-6">정산 대기 ({payouts.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {payouts.map(p => (
                  <div key={p.id} className="border border-line p-4">
                    <div className="mb-2">
                      <p className="text-[13px]">{p.participant?.user?.name}</p>
                      <p className="text-[11px] text-muted">{p.participant?.user?.email}</p>
                      <p className="text-[12px] text-muted mt-1 line-clamp-1">{p.submission?.mission?.title}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] space-x-2">
                        <span className="text-muted line-through">{Number(p.amount).toLocaleString()}원</span>
                        <span>{Number(p.netAmount).toLocaleString()}원</span>
                      </div>
                      <button onClick={() => processPayout(p.id)} className="btn-outline py-1.5 px-3 text-[11px]">지급 완료</button>
                    </div>
                  </div>
                ))}
                {payouts.length === 0 && <div className="text-center py-12 text-muted border border-line">대기 중인 정산이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block border border-line overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[600px]">
                    <thead className="bg-sand border-b border-line">
                      <tr>{['참여자', '미션', '지급액', '수수료', '실지급', '작업'].map(h => <th key={h} className="text-left px-4 py-3 text-[11px] tracking-wide text-muted font-normal">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {payouts.map(p => (
                        <tr key={p.id} className="hover:bg-sand/40">
                          <td className="px-4 py-3">
                            <p>{p.participant?.user?.name}</p>
                            <p className="text-[11px] text-muted">{p.participant?.user?.email}</p>
                          </td>
                          <td className="px-4 py-3 text-muted max-w-xs truncate">{p.submission?.mission?.title}</td>
                          <td className="px-4 py-3">{Number(p.amount).toLocaleString()}원</td>
                          <td className="px-4 py-3 text-muted">-{Number(p.platformFee).toLocaleString()}원</td>
                          <td className="px-4 py-3">{Number(p.netAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <button onClick={() => processPayout(p.id)} className="btn-outline py-1.5 px-3 text-[11px]">지급 완료 처리</button>
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
              <h2 className="font-serif italic text-xl mb-2">고객사 대신 미션 등록</h2>
              <p className="text-[13px] text-muted mb-6">고객사를 선택하고 미션을 대신 등록합니다. 결제 링크를 발송하면 고객사에게 SMS/카카오톡으로 전송됩니다.</p>
              <div className="border border-line p-6">
                <form onSubmit={handleRegisterMission} className="space-y-4">
                  <div>
                    <label className="field-label">고객사 선택 *</label>
                    <select required className="field-input"
                      value={registerForm.clientProfileId} onChange={e => rf('clientProfileId', e.target.value)}>
                      <option value="">고객사를 선택하세요</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.businessName} ({c.user?.email}){c.contactPhone ? ` · ${c.contactPhone}` : ' · 연락처 없음'}
                        </option>
                      ))}
                    </select>
                    {clients.length === 0 && <p className="text-[11px] text-muted mt-1">등록된 고객사가 없습니다. 먼저 CLIENT 계정을 만들어야 합니다.</p>}
                  </div>
                  <div>
                    <label className="field-label">미션 제목 *</label>
                    <input required className="field-input"
                      value={registerForm.title} onChange={e => rf('title', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">미션 설명 *</label>
                    <textarea required rows={3} className="field-input resize-none"
                      value={registerForm.description} onChange={e => rf('description', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">미션 유형 *</label>
                      <select required className="field-input" value={registerForm.category} onChange={e => rf('category', e.target.value)}>
                        {[['SNS', 'SNS 게시'], ['VISIT', '방문 인증'], ['REVIEW', '리뷰 작성'], ['VIDEO', '영상 제작']].map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">1인 보상금액 (원) *</label>
                      <input required type="number" min="1000" className="field-input"
                        value={registerForm.rewardAmount} onChange={e => rf('rewardAmount', e.target.value)} placeholder="예: 30000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">모집 인원 *</label>
                      <input required type="number" min="1" className="field-input"
                        value={registerForm.maxParticipants} onChange={e => rf('maxParticipants', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">지역 (시) *</label>
                      <input required className="field-input"
                        value={registerForm.regionSi} onChange={e => rf('regionSi', e.target.value)} placeholder="예: 서울시" />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">지역 (구) *</label>
                    <input required className="field-input"
                      value={registerForm.regionGu} onChange={e => rf('regionGu', e.target.value)} placeholder="예: 마포구" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {([['startDate', '시작일 *'], ['endDate', '종료일 *'], ['submissionDeadline', '제출 마감일 *']] as const).map(([k, l]) => (
                      <div key={k}>
                        <label className="field-label">{l}</label>
                        <input required type="date" className="field-input"
                          value={registerForm[k]} onChange={e => rf(k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="field-label">수행 조건 (선택)</label>
                    <textarea rows={2} className="field-input resize-none"
                      value={registerForm.requirements} onChange={e => rf('requirements', e.target.value)} />
                  </div>

                  {/* 결제 옵션 */}
                  <div className="bg-sand p-4">
                    <p className="field-label mb-3">결제 처리</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="radio" name="paymentOption" className="mt-0.5"
                          checked={!registerForm.sendPaymentLink}
                          onChange={() => rf('sendPaymentLink', false)} />
                        <div>
                          <p className="text-[13px]">결제 면제 (WAIVED)</p>
                          <p className="text-[11px] text-muted">운영자 테스트, 프로모션 등 결제 없이 바로 등록</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="radio" name="paymentOption" className="mt-0.5"
                          checked={registerForm.sendPaymentLink}
                          onChange={() => rf('sendPaymentLink', true)} />
                        <div>
                          <p className="text-[13px]">결제 링크 발송 (SMS/카카오톡)</p>
                          <p className="text-[11px] text-muted">
                            고객사 연락처로 결제 링크를 발송합니다.
                            {registerForm.clientProfileId && clients.find(c => c.id === registerForm.clientProfileId)?.contactPhone
                              ? ` 수신: ${clients.find(c => c.id === registerForm.clientProfileId)?.contactPhone}`
                              : ' (연락처가 없으면 발송되지 않습니다)'}
                          </p>
                        </div>
                      </label>
                    </div>
                    {registerForm.sendPaymentLink && registerForm.rewardAmount && registerForm.maxParticipants && (
                      <div className="mt-3 pt-3 border-t border-line text-[13px] text-muted">
                        결제 요청 금액: <strong className="text-ink">{(Number(registerForm.rewardAmount) * Number(registerForm.maxParticipants)).toLocaleString()}원</strong>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={registerSubmitting} className="btn-solid w-full disabled:opacity-50">
                    {registerSubmitting ? '등록 중...' : registerForm.sendPaymentLink ? '미션 등록 + 결제 링크 발송' : '미션 등록 (결제 면제)'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 회원 관리 */}
          {tab === 'users' && !loading && (
            <div>
              <h2 className="font-serif italic text-xl mb-6">회원 관리 ({users.length}명)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {users.map(u => (
                  <div key={u.id} className="border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px]">{u.name}</p>
                        <p className="text-[11px] text-muted truncate">{u.email}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <span className="border border-line px-2 py-0.5 text-[11px] text-muted">{ROLE_LABEL[u.role] ?? u.role}</span>
                          <span className="border border-line px-2 py-0.5 text-[11px] text-muted">
                            {u.isActive ? '활성' : '비활성'}
                          </span>
                        </div>
                      </div>
                      {u.id !== user.id && (
                        <button onClick={() => toggleUserActive(u.id, u.isActive)} className="shrink-0 btn-outline py-1.5 px-3 text-[11px]">
                          {u.isActive ? '비활성화' : '활성화'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="text-center py-12 text-muted border border-line">회원이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block border border-line overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[600px]">
                    <thead className="bg-sand border-b border-line">
                      <tr>{['이름/이메일', '역할', '상태', '가입일', '최근 로그인', '작업'].map(h => <th key={h} className="text-left px-4 py-3 text-[11px] tracking-wide text-muted font-normal">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-sand/40">
                          <td className="px-4 py-3">
                            <p>{u.name}</p>
                            <p className="text-[11px] text-muted">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="border border-line px-2 py-1 text-[11px] text-muted">{ROLE_LABEL[u.role] ?? u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="border border-line px-2 py-1 text-[11px] text-muted">
                              {u.isActive ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                          <td className="px-4 py-3 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-4 py-3">
                            {u.id !== user.id && (
                              <button onClick={() => toggleUserActive(u.id, u.isActive)} className="btn-outline py-1.5 px-3 text-[11px]">
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
    </div>
  );
}
