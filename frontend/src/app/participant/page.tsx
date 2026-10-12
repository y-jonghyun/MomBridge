'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'PARTICIPANT' && user.role !== 'OPERATOR') { router.push('/'); return; }
    loadMissions(missionFilter);
    loadNotifications();
  }, [user, hydrated]);

  async function loadNotifications() {
    try {
      const r = await api.get('/notifications');
      setNotifications(r.data.data.notifications);
      setUnreadCount(r.data.data.unreadCount);
    } catch { }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { }
  }

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
    { key: 'community' as Tab, label: '커뮤니티' },
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
    <div className="min-h-screen">
      <div className="bg-cream border-b border-line px-5 py-4 flex items-center justify-between">
        <div className="h-6 w-24 bg-sand animate-pulse" />
        <div className="h-5 w-16 bg-sand animate-pulse" />
      </div>
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-4">
        <div className="grid grid-cols-3 gap-px bg-line bg-white border border-line">
          {[1,2,3].map(i => <div key={i} className="bg-cream p-4 h-20 animate-pulse" />)}
        </div>
        <div className="bg-white border border-line h-12 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="bg-white border border-line h-48 animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-cream border-b border-line px-5 sm:px-10 py-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="font-serif italic text-lg whitespace-nowrap shrink-0">맘브릿지</Link>
          <span className="text-[11px] tracking-widest2 text-muted whitespace-nowrap shrink-0">참여자</span>
          {user.role === 'OPERATOR' && (
            <Link href="/operator" className="text-[11px] text-muted hover:text-ink bg-white border border-line px-2.5 py-1 whitespace-nowrap shrink-0">← 운영자</Link>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[12px] text-muted hidden sm:block">{user.name}님</span>
          {/* 알림 벨 */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifDropdown(v => !v); if (!showNotifDropdown) loadNotifications(); }}
              className="relative p-1.5 text-muted hover:text-ink transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-ink text-cream text-[10px] font-medium rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {/* 알림 드롭다운 */}
            {showNotifDropdown && (
              <div className="absolute right-0 top-9 w-80 bg-white border border-line z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <span className="text-[13px]">알림</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] text-muted hover:text-ink">전체 읽음</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-line">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-muted">알림이 없습니다</div>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 ${n.isRead ? '' : 'bg-sand'}`}>
                      <p className="text-[13px]">{n.title}</p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-muted mt-1">{new Date(n.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { clearAuth(); router.push('/login'); }} className="text-[11px] tracking-widest2 text-muted hover:text-ink whitespace-nowrap">로그아웃</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8">
        {/* 수익 요약 */}
        <div className="grid grid-cols-3 gap-px bg-line bg-white border border-line mb-8">
          <div className="bg-cream p-4 sm:p-5 text-center">
            <p className="text-[11px] text-muted mb-1">누적 수익</p>
            <p className="text-base sm:text-xl font-serif italic">{totalEarned.toLocaleString()}원</p>
          </div>
          <div className="bg-cream p-4 sm:p-5 text-center">
            <p className="text-[11px] text-muted mb-1">정산 대기</p>
            <p className="text-base sm:text-xl font-serif italic">{pendingEarned.toLocaleString()}원</p>
          </div>
          <div className="bg-cream p-4 sm:p-5 text-center">
            <p className="text-[11px] text-muted mb-1">완료 미션</p>
            <p className="text-base sm:text-xl font-serif italic">{earnings.filter(e => e.status === 'COMPLETED').length}건</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="overflow-x-auto mb-8">
          <div className="flex bg-white border border-line min-w-max sm:min-w-0">
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'missions') loadMissions(missionFilter); else loadTab(t.key); }}
                className={`flex-shrink-0 sm:flex-1 px-4 py-3 text-[12px] tracking-wide transition-colors whitespace-nowrap ${tab === t.key ? 'bg-ink text-cream' : 'text-muted hover:bg-sand'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white border border-line p-5 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-sand w-3/4" />
                    <div className="h-3 bg-sand w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-sand ml-4" />
                </div>
                <div className="h-3 bg-sand w-full mb-2" />
                <div className="h-3 bg-sand w-5/6" />
              </div>
            ))}
          </div>
        )}

        {/* 미션 탐색 필터 */}
        {tab === 'missions' && !loading && (
          <div className="bg-white border border-line p-4 mb-6 space-y-3">
            <form onSubmit={e => { e.preventDefault(); const nf = { ...missionFilter, keyword: searchInput }; setMissionFilter(nf); loadMissions(nf); }} className="flex">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="미션 검색..."
                className="flex-1 bg-white border border-line px-3 py-2 text-[13px] outline-none focus:border-ink" />
              <button type="submit" className="px-4 py-2 border border-l-0 border-line text-[12px] hover:bg-sand">검색</button>
            </form>
            <div className="grid grid-cols-3 gap-2">
              <select value={missionFilter.category}
                onChange={e => { const nf = { ...missionFilter, category: e.target.value }; setMissionFilter(nf); loadMissions(nf); }}
                className="bg-white border border-line px-2 py-2 text-[12px] outline-none w-full">
                <option value="">전체 유형</option>
                <option value="SNS">SNS</option>
                <option value="VISIT">방문형</option>
                <option value="REVIEW">리뷰</option>
                <option value="VIDEO">영상</option>
              </select>
              <select value={missionFilter.regionSi}
                onChange={e => { const nf = { ...missionFilter, regionSi: e.target.value }; setMissionFilter(nf); loadMissions(nf); }}
                className="bg-white border border-line px-2 py-2 text-[12px] outline-none w-full">
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
                className="bg-white border border-line px-2 py-2 text-[12px] outline-none w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            {missions.map(m => {
              const dday = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
              const catLabel: Record<string, string> = { VISIT: '방문인증', SNS: 'SNS', REVIEW: '리뷰', VIDEO: '영상' };
              const pct = Math.min(100, Math.round(((m.currentCount ?? 0) / m.maxParticipants) * 100));
              return (
                <Link key={m.id} href={`/missions/${m.id}`} className="block bg-white border border-line p-5 hover:bg-sand/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted bg-white border border-line px-2 py-0.5">
                        {catLabel[m.category] ?? m.category}
                      </span>
                      {dday >= 0 && dday <= 3 && <span className="text-[11px] bg-ink text-cream px-2 py-0.5">D-{dday || 'Day'}</span>}
                    </div>
                    <span className="text-[15px] font-serif italic">{Number(m.rewardAmount).toLocaleString()}원</span>
                  </div>
                  <h3 className="text-[14px] mb-1 leading-snug line-clamp-2">{m.title}</h3>
                  <p className="text-[11px] text-muted mb-3">{m.clientProfile?.businessName}</p>
                  <p className="text-[13px] text-muted line-clamp-2 mb-4">{m.description}</p>
                  {/* 정보 태그 */}
                  <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] text-muted">
                    <span>{m.regionSi} {m.regionGu}</span>
                    <span>·</span>
                    <span>{m.maxParticipants}명 모집</span>
                    <span>·</span>
                    <span>{new Date(m.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 마감</span>
                  </div>
                  {/* 신청 현황 바 */}
                  <div>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>신청 현황</span>
                      <span>{m.currentCount ?? 0}/{m.maxParticipants}명</span>
                    </div>
                    <div className="h-px bg-line overflow-hidden">
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {missions.length === 0 && <div className="col-span-2 text-center py-20 text-muted">오픈된 미션이 없습니다</div>}
          </div>
        )}

        {/* 내 지원 현황 */}
        {tab === 'my-applications' && !loading && (
          <div className="space-y-4">
            {applications.map(a => (
              <div key={a.id} className="bg-white border border-line p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-[13px]">{a.mission?.title}</p>
                    <p className="text-[12px] text-muted mt-1">지원일: {new Date(a.createdAt).toLocaleDateString('ko-KR')}</p>
                    {a.rejectionReason && <p className="text-[12px] text-muted mt-1">반려 사유: {a.rejectionReason}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-muted bg-white border border-line px-2.5 py-1">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <p className="text-[13px] mt-1">{Number(a.mission?.rewardAmount).toLocaleString()}원</p>
                  </div>
                </div>
                {a.status === 'APPROVED' && (
                  <div className="mt-3 pt-3 border-t border-line">
                    {submittedMissionIds.has(a.missionId) ? (
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        <span>✓ 콘텐츠 제출 완료</span>
                        <span>— 운영자 검수 중</span>
                      </div>
                    ) : (
                      <button onClick={() => setSubmitModal(a)} className="btn-solid w-full">
                        콘텐츠 제출하기
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {applications.length === 0 && <div className="text-center py-20 text-muted bg-white border border-line">지원한 미션이 없습니다</div>}
          </div>
        )}

        {/* 제출 내역 */}
        {tab === 'my-submissions' && !loading && (
          <div className="space-y-4">
            {submissions.map(s => (
              <div key={s.id} className="bg-white border border-line p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[13px]">{s.mission?.title}</p>
                  <span className="text-[11px] text-muted bg-white border border-line px-2.5 py-1">
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
                {s.description && <p className="text-[12px] bg-sand p-3 mt-2">{s.description}</p>}
                {s.reviewNote && <p className="text-[12px] text-muted mt-2">검수 메모: {s.reviewNote}</p>}
                {s.rejectionReason && <p className="text-[12px] text-muted mt-2">반려 사유: {s.rejectionReason}</p>}
                <p className="text-[11px] text-muted mt-2">제출: {new Date(s.submittedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
            {submissions.length === 0 && <div className="text-center py-20 text-muted bg-white border border-line">제출한 콘텐츠가 없습니다</div>}
          </div>
        )}

        {/* 수익 현황 */}
        {tab === 'earnings' && !loading && (
          <div className="space-y-4">
            {earnings.map(e => (
              <div key={e.id} className="bg-white border border-line p-5 flex items-center justify-between">
                <div>
                  <p className="text-[13px]">{e.submission?.mission?.title}</p>
                  <p className="text-[12px] text-muted mt-1">{new Date(e.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif italic text-lg">{Number(e.netAmount).toLocaleString()}원</p>
                  <p className="text-[11px] text-muted">수수료 -{Number(e.platformFee).toLocaleString()}원</p>
                  <span className="mt-1 inline-block bg-white border border-line px-2 py-0.5 text-[11px] text-muted">
                    {e.status === 'COMPLETED' ? '지급완료' : '정산대기'}
                  </span>
                </div>
              </div>
            ))}
            {earnings.length === 0 && <div className="text-center py-20 text-muted bg-white border border-line">수익 내역이 없습니다</div>}
          </div>
        )}

        {/* 커뮤니티 */}
        {tab === 'community' && (
          <div>
            {/* 카테고리 필터 + 글쓰기 */}
            <div className="bg-white border border-line mb-6 px-4 py-4 space-y-3">
              {/* 1행: 카테고리 가로 스크롤 */}
              <div className="flex gap-1.5 overflow-x-auto">
                {COMM_CATS.map(c => (
                  <button key={c.key}
                    onClick={() => { setCommunityCategory(c.key); loadCommunity(c.key, communitySort); }}
                    className={`shrink-0 px-3 py-1.5 text-[11px] tracking-wide border transition-colors ${communityCategory === c.key ? 'bg-ink text-cream border-ink' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              {/* 2행: 정렬 + 글쓰기 */}
              <div className="flex items-center justify-between">
                <select value={communitySort}
                  onChange={e => { setCommunitySort(e.target.value); loadCommunity(communityCategory, e.target.value); }}
                  className="bg-white border border-line px-2 py-1.5 text-[12px] outline-none">
                  <option value="NEWEST">최신순</option>
                  <option value="POPULAR">인기순</option>
                  <option value="VIEWS">조회순</option>
                </select>
                <button onClick={() => setShowWriteModal(true)} className="btn-outline py-1.5 px-4 text-[11px]">
                  글쓰기
                </button>
              </div>
            </div>

            {/* 게시글 목록 */}
            {loading && <div className="flex justify-center py-16"><div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" /></div>}
            {!loading && (
              <div className="bg-white border border-line overflow-hidden">
                {/* 모바일: 카드형 */}
                <div className="sm:hidden divide-y divide-line">
                  {communityPosts.map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-sand/40 transition-colors">
                      <span className="text-[11px] text-muted bg-white border border-line px-2 py-0.5 shrink-0 mt-0.5 min-w-[56px] text-center">{p.category}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] line-clamp-2">{p.title}</p>
                        <p className="text-[11px] text-muted mt-1">{p.user?.name} · {commTimeAgo(p.createdAt)} · 조회 {p.viewCount} · 좋아요 {p.likeCount}</p>
                      </div>
                    </Link>
                  ))}
                  {communityPosts.length === 0 && <div className="text-center py-16 text-muted text-[13px]">게시글이 없습니다</div>}
                </div>
                {/* 데스크탑: 테이블형 */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-[90px_1fr_72px_64px_48px_48px] gap-2 px-4 py-2.5 bg-sand border-b border-line text-[11px] tracking-wide text-muted">
                    <span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span className="text-center">조회</span><span className="text-center">좋아요</span>
                  </div>
                  {communityPosts.map(p => (
                    <Link key={p.id} href={`/community/${p.id}`}
                      className="grid grid-cols-[90px_1fr_72px_64px_48px_48px] gap-2 px-4 py-3 border-b border-line last:border-0 hover:bg-sand/40 transition-colors items-center">
                      <span className="text-[11px] text-muted truncate">{p.category}</span>
                      <div className="min-w-0">
                        <span className="text-[13px] line-clamp-1">{p.title}</span>
                        {p._count?.comments > 0 && <span className="text-[11px] text-muted ml-1">[{p._count.comments}]</span>}
                      </div>
                      <span className="text-[11px] text-muted truncate">{p.user?.name}</span>
                      <span className="text-[11px] text-muted">{commTimeAgo(p.createdAt)}</span>
                      <span className="text-[11px] text-muted text-center">{p.viewCount}</span>
                      <span className="text-[11px] text-muted text-center">{p.likeCount}</span>
                    </Link>
                  ))}
                  {communityPosts.length === 0 && <div className="text-center py-16 text-muted text-[13px]">게시글이 없습니다</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 콘텐츠 제출 모달 */}
      {submitModal && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <div className="bg-cream w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div>
                <h2 className="font-serif italic text-lg">콘텐츠 제출</h2>
                <p className="text-[11px] text-muted mt-0.5">{submitModal.mission?.title}</p>
              </div>
              <button onClick={() => setSubmitModal(null)} className="text-muted hover:text-ink text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmitContent} className="p-6 space-y-4">
              <div>
                <label className="field-label">활동 내용 *</label>
                <textarea required rows={4}
                  className="field-input resize-none"
                  value={submitForm.description}
                  onChange={e => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="미션 수행 내용을 작성해주세요" />
              </div>
              <div>
                <label className="field-label">SNS 게시물 URL (선택)</label>
                <input
                  className="field-input"
                  value={submitForm.snsPostUrl}
                  onChange={e => setSubmitForm(f => ({ ...f, snsPostUrl: e.target.value }))}
                  placeholder="https://www.instagram.com/p/..." />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSubmitModal(null)} className="btn-outline py-2 px-4">취소</button>
                <button type="submit" disabled={submittingContent} className="btn-solid py-2 px-6 disabled:opacity-50">
                  {submittingContent ? '제출 중...' : '제출하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <div className="bg-cream w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="font-serif italic text-lg">게시글 작성</h2>
              <button onClick={() => setShowWriteModal(false)} className="text-muted hover:text-ink text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleWritePost} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">카테고리</label>
                  <select required className="field-input"
                    value={writeForm.category} onChange={e => setWriteForm(f => ({ ...f, category: e.target.value }))}>
                    {COMM_CATS.filter(c => c.key !== 'ALL').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">작성자</label>
                  <div className="field-input text-muted">{user.name}</div>
                </div>
              </div>
              <div>
                <label className="field-label">제목</label>
                <input required className="field-input"
                  value={writeForm.title} onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))} placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="field-label">내용</label>
                <textarea required rows={7} className="field-input resize-none"
                  value={writeForm.content} onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))} placeholder="내용을 입력하세요" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowWriteModal(false)} className="btn-outline py-2 px-4">취소</button>
                <button type="submit" disabled={submittingPost} className="btn-solid py-2 px-6 disabled:opacity-50">
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
