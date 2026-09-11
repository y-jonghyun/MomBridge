'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Tab = 'my-missions' | 'create' | 'results';

const STATUS_LABEL: Record<string, string> = { DRAFT: '임시저장', OPEN: '모집중', IN_PROGRESS: '진행중', REVIEWING: '검수중', CLOSED: '종료' };
const STATUS_COLOR: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-600', OPEN: 'bg-green-100 text-green-700', IN_PROGRESS: 'bg-blue-100 text-blue-700', REVIEWING: 'bg-yellow-100 text-yellow-700', CLOSED: 'bg-red-100 text-red-600' };

const defaultForm = {
  title: '', description: '', category: 'SNS',
  rewardAmount: '', maxParticipants: '5',
  regionSi: '', regionGu: '',
  startDate: '', endDate: '', submissionDeadline: '',
  requirements: '',
};

export default function ClientPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('my-missions');
  const [missions, setMissions] = useState<any[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [missionDetail, setMissionDetail] = useState<{ applications: any[]; submissions: any[] } | null>(null);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'CLIENT' && user.role !== 'OPERATOR') { router.push('/'); return; }
    loadMissions();
  }, [user, hydrated]);

  async function loadMissions() {
    setLoading(true);
    try {
      const r = await api.get('/client/missions');
      setMissions(r.data.data);
    } catch { /* 에러 무시 */ } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/missions', {
        ...form,
        rewardAmount: Number(form.rewardAmount),
        maxParticipants: Number(form.maxParticipants),
      });
      alert('미션이 등록됐습니다. 운영자 승인 후 오픈됩니다.');
      setForm(defaultForm);
      setTab('my-missions');
      loadMissions();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '등록에 실패했습니다');
    } finally { setSubmitting(false); }
  }

  async function loadMissionDetail(mission: any) {
    setSelectedMission(mission);
    const [appR, subR] = await Promise.all([
      api.get(`/client/missions/${mission.id}/applications`),
      api.get(`/client/missions/${mission.id}/submissions`),
    ]);
    setMissionDetail({ applications: appR.data.data, submissions: subR.data.data });
    setTab('results');
  }

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  if (!hydrated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-purple-700">맘브릿지</h1>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">고객사</span>
          {user.role === 'OPERATOR' && (
            <Link href="/operator" className="text-xs text-gray-400 hover:text-purple-600 border border-gray-200 px-2 py-1 rounded-full">← 운영자로 돌아가기</Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.name}님</span>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-sm text-gray-400 hover:text-red-500">로그아웃</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-6">
          {([['my-missions', '내 미션 목록'], ['create', '미션 등록'], ['results', '결과 리포트']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 내 미션 목록 */}
        {tab === 'my-missions' && (
          <div className="space-y-3">
            {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && missions.map(m => (
              <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{m.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status] ?? 'bg-gray-100'}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-1">{m.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>보상 {Number(m.rewardAmount).toLocaleString()}원</span>
                      <span>지원자 {m._count?.applications ?? 0}명</span>
                      <span>제출 {m._count?.submissions ?? 0}건</span>
                      <span>마감 {new Date(m.endDate).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <button onClick={() => loadMissionDetail(m)} className="ml-4 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50">결과보기</button>
                </div>
              </div>
            ))}
            {!loading && missions.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl text-gray-400">
                <p className="mb-4">등록한 미션이 없습니다</p>
                <button onClick={() => setTab('create')} className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold">첫 미션 등록하기</button>
              </div>
            )}
          </div>
        )}

        {/* 미션 등록 */}
        {tab === 'create' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">미션 등록</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">미션 제목 *</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={form.title} onChange={e => f('title', e.target.value)} placeholder="예: 우리 카페 방문 후 인스타 업로드" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">미션 설명 *</label>
                <textarea required rows={4} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  value={form.description} onChange={e => f('description', e.target.value)} placeholder="미션 내용을 자세히 설명해주세요" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">미션 유형 *</label>
                  <select required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => f('category', e.target.value)}>
                    {[['SNS', 'SNS 게시'], ['VISIT', '방문 인증'], ['REVIEW', '리뷰 작성'], ['VIDEO', '영상 제작']].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1인 보상금액 (원) *</label>
                  <input required type="number" min="1000" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.rewardAmount} onChange={e => f('rewardAmount', e.target.value)} placeholder="예: 30000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">모집 인원 *</label>
                  <input required type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.maxParticipants} onChange={e => f('maxParticipants', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지역 (시) *</label>
                  <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.regionSi} onChange={e => f('regionSi', e.target.value)} placeholder="예: 서울시" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 (구) *</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={form.regionGu} onChange={e => f('regionGu', e.target.value)} placeholder="예: 마포구" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {([['startDate', '시작일 *'], ['endDate', '종료일 *'], ['submissionDeadline', '제출 마감일 *']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                    <input required type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      value={form[k]} onChange={e => f(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수행 조건 (선택)</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  value={form.requirements} onChange={e => f('requirements', e.target.value)} placeholder="예: 인스타그램 팔로워 500명 이상, 게시물 24시간 이상 유지" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold hover:bg-purple-700 disabled:opacity-50">
                {submitting ? '등록 중...' : '미션 등록하기'}
              </button>
            </form>
          </div>
        )}

        {/* 결과 리포트 */}
        {tab === 'results' && (
          <div>
            {!selectedMission ? (
              <div className="text-center py-20 text-gray-400 bg-white rounded-2xl">미션 목록에서 결과보기를 클릭하세요</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{selectedMission.title}</h3>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>보상 {Number(selectedMission.rewardAmount).toLocaleString()}원</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selectedMission.status] ?? 'bg-gray-100'}`}>{STATUS_LABEL[selectedMission.status]}</span>
                  </div>
                </div>
                {missionDetail && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: '총 지원자', value: missionDetail.applications.length, color: 'text-blue-600' },
                        { label: '승인된 지원', value: missionDetail.applications.filter(a => a.status === 'APPROVED').length, color: 'text-green-600' },
                        { label: '콘텐츠 제출', value: missionDetail.submissions.length, color: 'text-purple-600' },
                      ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
                          <p className="text-sm text-gray-500 mb-1">{s.label}</p>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {missionDetail.submissions.length > 0 && (
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-4">제출된 콘텐츠</h4>
                        <div className="space-y-3">
                          {missionDetail.submissions.map((s: any) => (
                            <div key={s.id} className="border rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-gray-700">{s.participant?.user?.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                              </div>
                              {s.description && <p className="text-sm text-gray-600">{s.description}</p>}
                              {s.snsPostUrl && <a href={s.snsPostUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">SNS 링크 →</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
