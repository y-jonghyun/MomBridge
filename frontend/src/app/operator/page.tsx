'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Tab = 'overview' | 'missions' | 'applications' | 'submissions' | 'payouts' | 'users';

const MISSION_STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료' };
const MISSION_STATUS_COLOR: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-600', OPEN: 'bg-green-100 text-green-700', IN_PROGRESS: 'bg-blue-100 text-blue-700', REVIEWING: 'bg-yellow-100 text-yellow-700', CLOSED: 'bg-red-100 text-red-600' };
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
  const [loading, setLoading] = useState(false);

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

  if (!user) return null;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'overview', label: '개요' },
    { key: 'missions', label: '미션 관리' },
    { key: 'applications', label: '지원서 승인', badge: stats?.pendingApplications },
    { key: 'submissions', label: '콘텐츠 검수', badge: stats?.pendingSubmissions },
    { key: 'payouts', label: '정산 처리', badge: stats?.pendingPayouts },
    { key: 'users', label: '회원 관리' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-purple-700">맘브릿지</h1>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">운영자</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.name}</span>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-sm text-gray-400 hover:text-red-500">로그아웃</button>
        </div>
      </header>

      {/* 모바일 탭 (sm 미만) */}
      <div className="sm:hidden bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.key} onClick={() => loadTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500'}`}>
              {t.label}
              {!!t.badge && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">{t.badge}</span>}
            </button>
          ))}
          <div className="w-px bg-gray-200 my-2" />
          <Link href="/participant" className="flex items-center gap-1 px-4 py-3 text-xs font-medium whitespace-nowrap text-blue-600 border-b-2 border-transparent">
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">참여자</span>
          </Link>
          <Link href="/client" className="flex items-center gap-1 px-4 py-3 text-xs font-medium whitespace-nowrap text-orange-600 border-b-2 border-transparent">
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">고객사</span>
          </Link>
          <Link href="/community" className="flex items-center gap-1 px-4 py-3 text-xs font-medium whitespace-nowrap text-green-600 border-b-2 border-transparent">
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">커뮤니티</span>
          </Link>
        </div>
      </div>

      <div className="flex">
        {/* 사이드바 (데스크탑만) */}
        <aside className="hidden sm:flex w-52 min-h-[calc(100vh-65px)] bg-white border-r py-4 flex-col">
          <div className="flex-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => loadTab(t.key)}
                className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                {t.label}
                {!!t.badge && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{t.badge}</span>}
              </button>
            ))}
          </div>
          <div className="border-t pt-3 px-3 space-y-1">
            <p className="text-xs text-gray-400 px-2 pb-1">미리보기</p>
            <Link href="/participant" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700">
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">참여자</span>
              참여자 화면
            </Link>
            <Link href="/client" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-orange-50 hover:text-orange-700">
              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">고객사</span>
              고객사 화면
            </Link>
            <Link href="/community" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-green-50 hover:text-green-700">
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">커뮤니티</span>
              커뮤니티
            </Link>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-3 sm:p-6 min-w-0">
          {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}

          {/* 개요 */}
          {tab === 'overview' && stats && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">대시보드 개요</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: '전체 회원', value: stats.totalUsers, color: 'text-blue-600' },
                  { label: '전체 미션', value: stats.totalMissions, color: 'text-purple-600' },
                  { label: '지원서 대기', value: stats.pendingApplications, color: 'text-yellow-600' },
                  { label: '검수 대기', value: stats.pendingSubmissions, color: 'text-orange-600' },
                  { label: '정산 대기', value: stats.pendingPayouts, color: 'text-red-600' },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                    <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              {stats.missionsByStatus && (
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">미션 상태별 현황</h3>
                  <div className="flex gap-3 flex-wrap">
                    {(stats.missionsByStatus as any[]).map(s => (
                      <div key={s.status} className={`px-4 py-2 rounded-xl text-sm font-medium ${MISSION_STATUS_COLOR[s.status] ?? 'bg-gray-100'}`}>
                        {MISSION_STATUS_LABEL[s.status] ?? s.status}: {s._count}건
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                {([['applications', '지원서 승인 처리'], ['submissions', '콘텐츠 검수'], ['payouts', '정산 처리']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => loadTab(key)}
                    className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow">
                    <p className="font-semibold text-gray-900 mb-1">{label} →</p>
                    <p className="text-sm text-gray-500">대기 항목 처리하기</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 미션 관리 */}
          {tab === 'missions' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">미션 관리 ({missions.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {missions.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm line-clamp-2">{m.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.clientProfile?.businessName}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${MISSION_STATUS_COLOR[m.status] ?? 'bg-gray-100'}`}>
                        {MISSION_STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400 space-x-2">
                        <span>지원 {m._count?.applications}건</span>
                        <span>제출 {m._count?.submissions}건</span>
                        <span className="text-gray-700 font-medium">{Number(m.rewardAmount).toLocaleString()}원</span>
                      </div>
                      <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1 text-gray-700">
                        {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(s => (
                          <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {missions.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">미션이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['미션명', '고객사', '상태', '지원/제출', '보상', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {missions.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{m.title}</td>
                          <td className="px-4 py-3 text-gray-500">{m.clientProfile?.businessName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${MISSION_STATUS_COLOR[m.status] ?? 'bg-gray-100'}`}>
                              {MISSION_STATUS_LABEL[m.status] ?? m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{m._count?.applications} / {m._count?.submissions}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">{Number(m.rewardAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <select value={m.status} onChange={e => updateMissionStatus(m.id, e.target.value)}
                              className="text-xs border rounded px-2 py-1 text-gray-700">
                              {['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED'].map(s => (
                                <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {missions.length === 0 && <div className="text-center py-12 text-gray-400">미션이 없습니다</div>}
                </div>
              </div>
            </div>
          )}

          {/* 지원서 승인 */}
          {tab === 'applications' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">지원서 승인 대기 ({applications.length}건)</h2>
              <div className="space-y-3">
                {applications.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{a.mission?.title}</p>
                        <p className="text-sm text-gray-500 mt-1">{a.participant?.user?.name} ({a.participant?.user?.email})</p>
                        {a.message && <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg p-2">{a.message}</p>}
                      </div>
                      <span className="text-sm font-bold text-purple-600">{Number(a.mission?.rewardAmount).toLocaleString()}원</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => reviewApplication(a.id, 'APPROVED')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">승인</button>
                      <button onClick={() => reviewApplication(a.id, 'REJECTED')} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">반려</button>
                    </div>
                  </div>
                ))}
                {applications.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">대기 중인 지원서가 없습니다</div>}
              </div>
            </div>
          )}

          {/* 콘텐츠 검수 */}
          {tab === 'submissions' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">콘텐츠 검수 대기 ({submissions.length}건)</h2>
              <div className="space-y-3">
                {submissions.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{s.mission?.title}</p>
                        <p className="text-sm text-gray-500">{s.participant?.user?.name} ({s.participant?.user?.email})</p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(s.submittedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    {s.description && <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-3">{s.description}</p>}
                    {s.snsPostUrl && <a href={s.snsPostUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline block mb-3">SNS 링크 보기 →</a>}
                    {s.mediaUrls?.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {s.mediaUrls.map((url: string, i: number) => <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">첨부 {i + 1}</a>)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => reviewSubmission(s.id, 'APPROVED')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">승인 (정산 생성)</button>
                      <button onClick={() => reviewSubmission(s.id, 'REJECTED')} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">반려</button>
                    </div>
                  </div>
                ))}
                {submissions.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">대기 중인 제출물이 없습니다</div>}
              </div>
            </div>
          )}

          {/* 정산 처리 */}
          {tab === 'payouts' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">정산 대기 ({payouts.length}건)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {payouts.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="mb-2">
                      <p className="font-semibold text-gray-900 text-sm">{p.participant?.user?.name}</p>
                      <p className="text-xs text-gray-400">{p.participant?.user?.email}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.submission?.mission?.title}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm space-x-2">
                        <span className="text-gray-400 line-through">{Number(p.amount).toLocaleString()}원</span>
                        <span className="font-bold text-green-600">{Number(p.netAmount).toLocaleString()}원</span>
                      </div>
                      <button onClick={() => processPayout(p.id)} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg">지급 완료</button>
                    </div>
                  </div>
                ))}
                {payouts.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">대기 중인 정산이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['참여자', '미션', '지급액', '수수료', '실지급', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {payouts.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.participant?.user?.name}</p>
                            <p className="text-xs text-gray-400">{p.participant?.user?.email}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{p.submission?.mission?.title}</td>
                          <td className="px-4 py-3 font-medium">{Number(p.amount).toLocaleString()}원</td>
                          <td className="px-4 py-3 text-red-500">-{Number(p.platformFee).toLocaleString()}원</td>
                          <td className="px-4 py-3 font-bold text-green-600">{Number(p.netAmount).toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <button onClick={() => processPayout(p.id)} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">지급 완료 처리</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payouts.length === 0 && <div className="text-center py-12 text-gray-400">대기 중인 정산이 없습니다</div>}
                </div>
              </div>
            </div>
          )}

          {/* 회원 관리 */}
          {tab === 'users' && !loading && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">회원 관리 ({users.length}명)</h2>
              {/* 모바일 카드형 */}
              <div className="sm:hidden space-y-3">
                {users.map(u => (
                  <div key={u.id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{ROLE_LABEL[u.role] ?? u.role}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {u.isActive ? '활성' : '비활성'}
                          </span>
                        </div>
                      </div>
                      {u.id !== user.id && (
                        <button onClick={() => toggleUserActive(u.id, u.isActive)}
                          className={`shrink-0 px-3 py-1.5 text-xs rounded-lg text-white ${u.isActive ? 'bg-red-500' : 'bg-green-600'}`}>
                          {u.isActive ? '비활성화' : '활성화'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">회원이 없습니다</div>}
              </div>
              {/* 데스크탑 테이블형 */}
              <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['이름/이메일', '역할', '상태', '가입일', '최근 로그인', '작업'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{ROLE_LABEL[u.role] ?? u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {u.isActive ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                          <td className="px-4 py-3 text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-4 py-3">
                            {u.id !== user.id && (
                              <button onClick={() => toggleUserActive(u.id, u.isActive)}
                                className={`px-3 py-1.5 text-xs rounded-lg text-white ${u.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                                {u.isActive ? '비활성화' : '활성화'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && <div className="text-center py-12 text-gray-400">회원이 없습니다</div>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
