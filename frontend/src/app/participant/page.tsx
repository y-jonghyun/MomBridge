'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Tab = 'missions' | 'my-applications' | 'my-submissions' | 'earnings' | 'community';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토중', APPROVED: '승인', REJECTED: '반려', CANCELED: '취소',
  SUBMITTED: '제출완료', REVISION: '수정요청',
  PENDING_PAYOUT: '정산대기', COMPLETED: '지급완료',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600', SUBMITTED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-slate-100 text-slate-700',
};

export default function ParticipantPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('missions');
  const [missions, setMissions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [communityCategory, setCommunityCategory] = useState('ALL');
  const [communitySort, setCommunitySort] = useState('NEWEST');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeForm, setWriteForm] = useState({ category: '체험후기', title: '', content: '' });
  const [submittingPost, setSubmittingPost] = useState(false);
  const [submitModal, setSubmitModal] = useState<any>(null);
  const [submitForm, setSubmitForm] = useState({ description: '', snsPostUrl: '' });
  const [submittingContent, setSubmittingContent] = useState(false);
  const [submittedMissionIds, setSubmittedMissionIds] = useState<Set<string>>(new Set());

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'PARTICIPANT' && user.role !== 'OPERATOR') { router.push('/'); return; }
    loadMissions(missionFilter);
  }, [user, hydrated]);

  async function loadMissions(f: typeof missionFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: f.sort });
      if (f.category) params.set('category', f.category);
      if (f.regionSi) params.set('regionSi', f.regionSi);
      if (f.keyword) params.set('keyword', f.keyword);
      const r = await api.get(`/missions?${params}`);
      setMissions(r.data.data.missions);
    } catch { } finally { setLoading(false); }
  }

  const loadedTabs = useState<Set<Tab>>(() => new Set<Tab>())[0];

  const loadTab = useCallback(async (t: Tab, force = false) => {
    setTab(t);
    if (!force && loadedTabs.has(t)) return;
    setLoading(true);
    try {
      if (t === 'my-applications') {
        const [appR, subR] = await Promise.all([
          api.get('/participant/applications'),
          api.get('/submissions/my'),
        ]);
        setApplications(appR.data.data);
        setSubmittedMissionIds(new Set(subR.data.data.map((s: any) => s.missionId)));
      }
      if (t === 'my-submissions') {
        const r = await api.get('/submissions/my');
        setSubmissions(r.data.data);
      }
      if (t === 'earnings') {
        const r = await api.get('/participant/payouts');
        setEarnings(r.data.data);
      }
      if (t === 'community') {
        const r = await api.get('/community/posts?limit=20&sort=NEWEST');
        setCommunityPosts(r.data.data.posts);
      }
      loadedTabs.add(t);
    } catch { } finally { setLoading(false); }
  }, [loadedTabs]);

  async function loadCommunity(cat = communityCategory, sort = communitySort) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', sort });
      if (cat !== 'ALL') params.set('category', cat);
      const r = await api.get(`/community/posts?${params}`);
      setCommunityPosts(r.data.data.posts);
    } catch { } finally { setLoading(false); }
  }

  async function handleWritePost(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingPost(true);
    try {
      await api.post('/community/posts', writeForm);
      setShowWriteModal(false);
      setWriteForm({ category: '체험후기', title: '', content: '' });
      loadCommunity();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '작성 실패');
    } finally { setSubmittingPost(false); }
  }

  async function handleSubmitContent(e: React.FormEvent) {
    e.preventDefault();
    if (!submitModal) return;
    setSubmittingContent(true);
    try {
      await api.post('/submissions', { missionId: submitModal.missionId, ...submitForm });
      setSubmittedMissionIds(prev => { const s = new Set(prev); s.add(submitModal.missionId); return s; });
      setSubmitModal(null);
      setSubmitForm({ description: '', snsPostUrl: '' });
      alert('제출 완료! 운영자 검수 후 정산됩니다.');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '제출에 실패했습니다');
    } finally { setSubmittingContent(false); }
  }

  async function applyMission(missionId: string, message: string) {
    await api.post('/submissions/apply', { missionId, message });
    alert('지원 완료!');
  }

  const totalEarned = earnings.filter(e => e.status === 'COMPLETED').reduce((sum, e) => sum + Number(e.netAmount), 0);
  const pendingEarned = earnings.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + Number(e.netAmount), 0);

  const tabs = [
    { key: 'missions' as Tab, label: '미션 탐색' },
    { key: 'community' as Tab, label: '💬 커뮤니티' },
    { key: 'my-applications' as Tab, label: '내 지원 현황' },
    { key: 'my-submissions' as Tab, label: '제출 내역' },
    { key: 'earnings' as Tab, label: '수익 현황' },
  ];

  const COMM_CATS = [
    { key: 'ALL', label: '전체' }, { key: '체험후기', label: '체험후기' },
    { key: '미션팁', label: '미션팁' }, { key: '지역정보', label: '지역정보' },
    { key: '자유게시판', label: '자유게시판' }, { key: '질문', label: '질문' },
  ];

  function commTimeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  const [missionFilter, setMissionFilter] = useState({ category: '', regionSi: '', sort: 'NEWEST', keyword: '' });
  const [searchInput, setSearchInput] = useState('');

  if (!hydrated || !user) return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="max-w-5xl mx-auto px-3 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-4 h-20 animate-pulse bg-gray-100" />)}
        </div>
        <div className="bg-white rounded-xl h-12 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-700 whitespace-nowrap shrink-0">맘브릿지</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">참여자</span>
          {user.role === 'OPERATOR' && (
            <Link href="/operator" className="text-xs text-gray-400 hover:text-slate-600 border border-gray-200 px-2 py-1 rounded-full whitespace-nowrap shrink-0">← 운영자</Link>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span className="text-xs sm:text-sm text-gray-500 hidden sm:block">{user.name}님</span>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-xs sm:text-sm text-gray-400 hover:text-red-500 whitespace-nowrap">로그아웃</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* 수익 요약 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">누적 수익</p>
            <p className="text-base sm:text-2xl font-bold text-slate-600">{totalEarned.toLocaleString()}원</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">정산 대기</p>
            <p className="text-base sm:text-2xl font-bold text-yellow-500">{pendingEarned.toLocaleString()}원</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">완료 미션</p>
            <p className="text-base sm:text-2xl font-bold text-green-600">{earnings.filter(e => e.status === 'COMPLETED').length}건</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 mb-4 sm:mb-6">
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mx-3 sm:mx-0 min-w-max sm:min-w-0">
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'missions') loadMissions(missionFilter); else loadTab(t.key); }}
                className={`flex-shrink-0 sm:flex-1 px-3 sm:px-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${tab === t.key ? 'bg-slate-700 text-white' : 'text-gray-600 hover:bg-stone-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-full ml-4" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
                <div className="flex gap-2 mt-4">
                  <div className="h-6 w-20 bg-gray-100 rounded-lg" />
                  <div className="h-6 w-20 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 미션 탐색 필터 */}
        {tab === 'missions' && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-2">
            <form onSubmit={e => { e.preventDefault(); const nf = { ...missionFilter, keyword: searchInput }; setMissionFilter(nf); loadMissions(nf); }} className="flex">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="미션 검색..."
                className="flex-1 border rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
              <button type="submit" className="px-3 py-2 bg-slate-700 text-white rounded-r-lg text-sm">🔍</button>
            </form>
            <div className="grid grid-cols-3 gap-2">
              <select value={missionFilter.category}
                onChange={e => { const nf = { ...missionFilter, category: e.target.value }; setMissionFilter(nf); loadMissions(nf); }}
                className="border rounded-lg px-2 py-2 text-xs sm:text-sm bg-white focus:outline-none w-full">
                <option value="">전체 유형</option>
                <option value="SNS">SNS</option>
                <option value="VISIT">방문형</option>
                <option value="REVIEW">리뷰</option>
                <option value="VIDEO">영상</option>
              </select>
              <select value={missionFilter.regionSi}
                onChange={e => { const nf = { ...missionFilter, regionSi: e.target.value }; setMissionFilter(nf); loadMissions(nf); }}
                className="border rounded-lg px-2 py-2 text-xs sm:text-sm bg-white focus:outline-none w-full">
                <option value="">전체 지역</option>
                <optgroup label="특별·광역시">
                  <option value="서울시">서울</option>
                  <option value="부산시">부산</option>
                  <option value="대구시">대구</option>
                  <option value="인천시">인천</option>
                  <option value="광주시">광주</option>
                  <option value="대전시">대전</option>
                  <option value="울산시">울산</option>
                  <option value="세종시">세종</option>
                </optgroup>
                <optgroup label="도">
                  <option value="경기도">경기</option>
                  <option value="강원도">강원</option>
                  <option value="충청북도">충북</option>
                  <option value="충청남도">충남</option>
                  <option value="전북도">전북</option>
                  <option value="전라남도">전남</option>
                  <option value="경상북도">경북</option>
                  <option value="경상남도">경남</option>
                  <option value="제주도">제주</option>
                </optgroup>
              </select>
              <select value={missionFilter.sort}
                onChange={e => { const nf = { ...missionFilter, sort: e.target.value }; setMissionFilter(nf); loadMissions(nf); }}
                className="border rounded-lg px-2 py-2 text-xs sm:text-sm bg-white focus:outline-none w-full">
                <option value="NEWEST">최신순</option>
                <option value="DEADLINE">마감임박</option>
                <option value="REWARD">보상높은순</option>
                <option value="POPULAR">인기순</option>
              </select>
            </div>
          </div>
        )}

        {/* 미션 탐색 */}
        {tab === 'missions' && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missions.map(m => {
              const dday = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
              const catIcon: Record<string, string> = { VISIT: '📍', SNS: '📸', REVIEW: '✍️', VIDEO: '🎬' };
              const catLabel: Record<string, string> = { VISIT: '방문인증', SNS: 'SNS', REVIEW: '리뷰', VIDEO: '영상' };
              const catColor: Record<string, string> = { VISIT: 'bg-green-100 text-green-700', SNS: 'bg-pink-100 text-pink-700', REVIEW: 'bg-blue-100 text-blue-700', VIDEO: 'bg-red-100 text-red-700' };
              const pct = Math.min(100, Math.round(((m.currentCount ?? 0) / m.maxParticipants) * 100));
              return (
                <Link key={m.id} href={`/missions/${m.id}`}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-slate-200">
                  {/* 카드 상단 컬러 배너 */}
                  <div className="h-2 bg-gradient-to-r from-stone-300 to-slate-400" />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor[m.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {catIcon[m.category]} {catLabel[m.category] ?? m.category}
                        </span>
                        {dday >= 0 && dday <= 3 && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">D-{dday || 'Day'}</span>}
                      </div>
                      <span className="text-lg font-extrabold text-slate-600">{Number(m.rewardAmount).toLocaleString()}원</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1 text-base leading-snug line-clamp-2">{m.title}</h3>
                    <p className="text-xs text-gray-400 mb-3">{m.clientProfile?.businessName}</p>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{m.description}</p>
                    {/* 정보 태그 */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-xs bg-stone-50 text-gray-500 px-2 py-1 rounded-lg">📌 {m.regionSi} {m.regionGu}</span>
                      <span className="text-xs bg-stone-50 text-gray-500 px-2 py-1 rounded-lg">👥 {m.maxParticipants}명 모집</span>
                      <span className="text-xs bg-stone-50 text-gray-500 px-2 py-1 rounded-lg">📅 {new Date(m.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 마감</span>
                    </div>
                    {/* 신청 현황 바 */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>신청 현황</span>
                        <span className="font-semibold text-gray-600">{m.currentCount ?? 0}/{m.maxParticipants}명</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {missions.length === 0 && <div className="col-span-2 text-center py-20 text-gray-400">오픈된 미션이 없습니다</div>}
          </div>
        )}

        {/* 내 지원 현황 */}
        {tab === 'my-applications' && !loading && (
          <div className="space-y-3">
            {applications.map(a => (
              <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-semibold text-gray-900">{a.mission?.title}</p>
                    <p className="text-sm text-gray-500 mt-1">지원일: {new Date(a.createdAt).toLocaleDateString('ko-KR')}</p>
                    {a.rejectionReason && <p className="text-sm text-red-500 mt-1">반려 사유: {a.rejectionReason}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <p className="text-sm font-bold text-slate-600 mt-1">{Number(a.mission?.rewardAmount).toLocaleString()}원</p>
                  </div>
                </div>
                {a.status === 'APPROVED' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {submittedMissionIds.has(a.missionId) ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <span>✓ 콘텐츠 제출 완료</span>
                        <span className="text-xs text-gray-400">— 운영자 검수 중</span>
                      </div>
                    ) : (
                      <button onClick={() => setSubmitModal(a)}
                        className="w-full py-2.5 bg-slate-700 text-white text-sm font-bold rounded-xl hover:bg-slate-800">
                        📤 콘텐츠 제출하기
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {applications.length === 0 && <div className="text-center py-20 text-gray-400 bg-white rounded-2xl">지원한 미션이 없습니다</div>}
          </div>
        )}

        {/* 제출 내역 */}
        {tab === 'my-submissions' && !loading && (
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-gray-900">{s.mission?.title}</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
                {s.description && <p className="text-sm text-gray-600 bg-stone-50 rounded-lg p-3 mt-2">{s.description}</p>}
                {s.reviewNote && <p className="text-sm text-blue-600 mt-2">검수 메모: {s.reviewNote}</p>}
                {s.rejectionReason && <p className="text-sm text-red-500 mt-2">반려 사유: {s.rejectionReason}</p>}
                <p className="text-xs text-gray-400 mt-2">제출: {new Date(s.submittedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
            {submissions.length === 0 && <div className="text-center py-20 text-gray-400 bg-white rounded-2xl">제출한 콘텐츠가 없습니다</div>}
          </div>
        )}

        {/* 수익 현황 */}
        {tab === 'earnings' && !loading && (
          <div className="space-y-3">
            {earnings.map(e => (
              <div key={e.id} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{e.submission?.mission?.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{new Date(e.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 text-lg">{Number(e.netAmount).toLocaleString()}원</p>
                  <p className="text-xs text-gray-400">수수료 -{Number(e.platformFee).toLocaleString()}원</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${e.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {e.status === 'COMPLETED' ? '지급완료' : '정산대기'}
                  </span>
                </div>
              </div>
            ))}
            {earnings.length === 0 && <div className="text-center py-20 text-gray-400 bg-white rounded-2xl">수익 내역이 없습니다</div>}
          </div>
        )}

        {/* 커뮤니티 */}
        {tab === 'community' && (
          <div>
            {/* 카테고리 필터 + 글쓰기 */}
            <div className="bg-white rounded-xl shadow-sm mb-4 px-4 py-3 space-y-2">
              {/* 1행: 카테고리 가로 스크롤 */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {COMM_CATS.map(c => (
                  <button key={c.key}
                    onClick={() => { setCommunityCategory(c.key); loadCommunity(c.key, communitySort); }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${communityCategory === c.key ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              {/* 2행: 정렬 + 글쓰기 */}
              <div className="flex items-center justify-between">
                <select value={communitySort}
                  onChange={e => { setCommunitySort(e.target.value); loadCommunity(communityCategory, e.target.value); }}
                  className="border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                  <option value="NEWEST">최신순</option>
                  <option value="POPULAR">인기순</option>
                  <option value="VIEWS">조회순</option>
                </select>
                <button onClick={() => setShowWriteModal(true)}
                  className="px-4 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800">
                  ✏️ 글쓰기
                </button>
              </div>
            </div>

            {/* 게시글 목록 */}
            {loading && <div className="flex justify-center py-16"><div className="w-6 h-6 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                {/* 모바일: 카드형 */}
                <div className="sm:hidden divide-y">
                  {communityPosts.map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0 mt-0.5 min-w-[56px] text-center">{p.category}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{p.user?.name} · {commTimeAgo(p.createdAt)} · 👁 {p.viewCount} · ❤️ {p.likeCount}</p>
                      </div>
                    </Link>
                  ))}
                  {communityPosts.length === 0 && <div className="text-center py-16 text-gray-300 text-sm">게시글이 없습니다</div>}
                </div>
                {/* 데스크탑: 테이블형 */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[90px_1fr_72px_64px_48px_48px] gap-2 px-4 py-2.5 bg-stone-50 border-b text-xs font-semibold text-gray-500">
                    <span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span className="text-center">조회</span><span className="text-center">좋아요</span>
                  </div>
                  {communityPosts.map(p => (
                    <Link key={p.id} href={`/community/${p.id}`}
                      className="grid grid-cols-[90px_1fr_72px_64px_48px_48px] gap-2 px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors items-center group">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full truncate">{p.category}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 group-hover:text-slate-700 line-clamp-1">{p.title}</span>
                        {p._count?.comments > 0 && <span className="text-xs text-slate-400 ml-1">[{p._count.comments}]</span>}
                      </div>
                      <span className="text-xs text-gray-500 truncate">{p.user?.name}</span>
                      <span className="text-xs text-gray-400">{commTimeAgo(p.createdAt)}</span>
                      <span className="text-xs text-gray-400 text-center">{p.viewCount}</span>
                      <span className="text-xs text-red-400 text-center">❤️{p.likeCount}</span>
                    </Link>
                  ))}
                  {communityPosts.length === 0 && <div className="text-center py-16 text-gray-300 text-sm">게시글이 없습니다</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 콘텐츠 제출 모달 */}
      {submitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">콘텐츠 제출</h2>
                <p className="text-xs text-gray-400 mt-0.5">{submitModal.mission?.title}</p>
              </div>
              <button onClick={() => setSubmitModal(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmitContent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">활동 내용 *</label>
                <textarea required rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none resize-none"
                  value={submitForm.description}
                  onChange={e => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="미션 수행 내용을 작성해주세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SNS 게시물 URL (선택)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                  value={submitForm.snsPostUrl}
                  onChange={e => setSubmitForm(f => ({ ...f, snsPostUrl: e.target.value }))}
                  placeholder="https://www.instagram.com/p/..." />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSubmitModal(null)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-stone-50">취소</button>
                <button type="submit" disabled={submittingContent}
                  className="px-6 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50">
                  {submittingContent ? '제출 중...' : '제출하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900">게시글 작성</h2>
              <button onClick={() => setShowWriteModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleWritePost} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                  <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                    value={writeForm.category} onChange={e => setWriteForm(f => ({ ...f, category: e.target.value }))}>
                    {COMM_CATS.filter(c => c.key !== 'ALL').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">작성자</label>
                  <div className="border rounded-lg px-3 py-2 text-sm bg-stone-50 text-gray-400">{user.name}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">제목</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                  value={writeForm.title} onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))} placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">내용</label>
                <textarea required rows={7} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none resize-none"
                  value={writeForm.content} onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))} placeholder="내용을 입력하세요" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowWriteModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-stone-50">취소</button>
                <button type="submit" disabled={submittingPost} className="px-6 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50">
                  {submittingPost ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
