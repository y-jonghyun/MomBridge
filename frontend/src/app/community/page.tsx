'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const CATEGORIES = [
  { key: 'ALL', label: '전체' },
  { key: '체험후기', label: '체험 후기' },
  { key: '미션팁', label: '미션 팁' },
  { key: '지역정보', label: '지역 정보' },
  { key: '자유게시판', label: '자유게시판' },
  { key: '질문', label: '질문/문의' },
];

const ROLE_BADGE: Record<string, string> = {
  OPERATOR: 'bg-purple-100 text-purple-700',
  PARTICIPANT: 'bg-blue-50 text-blue-600',
  CLIENT: 'bg-orange-50 text-orange-600',
};
const ROLE_LABEL: Record<string, string> = { OPERATOR: '운영자', PARTICIPANT: '참여자', CLIENT: '고객사' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

type SortKey = 'NEWEST' | 'POPULAR' | 'VIEWS';

export default function CommunityPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState<'LIST' | 'BEST' | 'MY'>('LIST');
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('NEWEST');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [posts, setPosts] = useState<any[]>([]);
  const [bestPosts, setBestPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showWrite, setShowWrite] = useState(false);
  const [writeForm, setWriteForm] = useState({ category: '체험후기', title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  const loadPosts = useCallback(async (p = 1, cat = category, s = sort, kw = keyword) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '15', sort: s });
      if (cat !== 'ALL') params.set('category', cat);
      if (kw) params.set('keyword', kw);
      const r = await api.get(`/community/posts?${params}`);
      setPosts(r.data.data.posts);
      setTotal(r.data.data.total);
      setPage(p);
    } catch { } finally { setLoading(false); }
  }, [category, sort, keyword]);

  const loadBest = useCallback(async () => {
    try {
      const r = await api.get('/community/posts/best');
      setBestPosts(r.data.data);
    } catch { }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    loadPosts(1, category, sort, keyword);
    loadBest();
  }, [hydrated, category, sort]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setKeyword(searchInput);
    loadPosts(1, category, sort, searchInput);
  }

  async function handleWrite(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    setSubmitting(true);
    try {
      await api.post('/community/posts', writeForm);
      setShowWrite(false);
      setWriteForm({ category: '체험후기', title: '', content: '' });
      loadPosts(1, category, sort, keyword);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? '작성에 실패했습니다');
    } finally { setSubmitting(false); }
  }

  const backHref = user?.role === 'PARTICIPANT' ? '/participant' : user?.role === 'OPERATOR' ? '/operator' : user?.role === 'CLIENT' ? '/client' : '/';
  const myPosts = posts.filter(p => p.user?.id === user?.id);

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="text-gray-400 hover:text-gray-700 text-sm">←</Link>
            <h1 className="text-lg font-bold text-purple-700">맘브릿지</h1>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-700">커뮤니티</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <button onClick={() => setShowWrite(true)}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
                ✏️ 글 작성
              </button>
            )}
            {!user && (
              <Link href="/login" className="text-sm text-purple-600 font-semibold">로그인</Link>
            )}
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => { setCategory(c.key); loadPosts(1, c.key, sort, keyword); }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${category === c.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 flex gap-5">

        {/* ── 왼쪽 메인 ── */}
        <div className="flex-1 min-w-0">

          {/* 탭 + 검색 + 정렬 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex bg-white border rounded-lg overflow-hidden shadow-sm">
              {(['LIST', 'BEST', 'MY'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {t === 'LIST' ? '전체' : t === 'BEST' ? '🔥 BEST' : '내 글'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="flex flex-1 min-w-0">
              <input
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="게시글 검색..."
                className="flex-1 border rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-0"
              />
              <button type="submit" className="px-3 py-2 bg-purple-600 text-white rounded-r-lg text-sm hover:bg-purple-700">🔍</button>
            </form>

            <select value={sort} onChange={e => { setSort(e.target.value as SortKey); loadPosts(1, category, e.target.value as SortKey, keyword); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white shadow-sm">
              <option value="NEWEST">최신순</option>
              <option value="POPULAR">인기순</option>
              <option value="VIEWS">조회순</option>
            </select>
          </div>

          {/* BEST 탭 */}
          {tab === 'BEST' && (
            <div className="space-y-3">
              {bestPosts.map((p, i) => (
                <Link key={p.id} href={`/community/${p.id}`}
                  className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-start hover:shadow-md transition-all border border-gray-100 hover:border-purple-200 block">
                  <div className={`text-2xl font-black w-8 text-center shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{p.category}</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                    <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{p.content}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>❤️ {p._count?.likes ?? p.likeCount}</span>
                      <span>💬 {p._count?.comments}</span>
                      <span>👁 {p.viewCount}</span>
                      <span>{p.user?.name}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {bestPosts.length === 0 && <div className="text-center py-20 text-gray-300 bg-white rounded-xl">게시글이 없습니다</div>}
            </div>
          )}

          {/* 내 글 탭 */}
          {tab === 'MY' && !user && (
            <div className="text-center py-20 bg-white rounded-xl text-gray-400">
              <p className="mb-3">로그인 후 내 글을 확인할 수 있습니다</p>
              <Link href="/login" className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">로그인</Link>
            </div>
          )}

          {/* 게시글 목록 테이블 */}
          {(tab === 'LIST' || (tab === 'MY' && user)) && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
              {loading && (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-purple-500 border-t-transparent rounded-full animate-spin border-4" />
                </div>
              )}
              {/* 모바일: 카드형 */}
              {!loading && (
                <div className="lg:hidden divide-y">
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-purple-50">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0 mt-0.5 min-w-[56px] text-center">{p.category}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{p.user?.name} · {timeAgo(p.createdAt)} · 👁 {p.viewCount} · ❤️ {p.likeCount}</p>
                      </div>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-gray-300 text-sm">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
                  )}
                </div>
              )}
              {/* 데스크탑: 테이블형 */}
              {!loading && (
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b text-xs font-semibold text-gray-500">
                    <span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span className="text-center">조회</span><span className="text-center">좋아요</span>
                  </div>
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`}
                      className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-3 border-b last:border-0 hover:bg-purple-50 transition-colors items-center group">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full truncate">{p.category}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 group-hover:text-purple-700 line-clamp-1">{p.title}</span>
                        {p._count?.comments > 0 && <span className="text-xs text-purple-500 ml-1.5">[{p._count.comments}]</span>}
                      </div>
                      <span className="text-xs text-gray-500 truncate">{p.user?.name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(p.createdAt)}</span>
                      <span className="text-xs text-gray-400 text-center">{p.viewCount}</span>
                      <span className="text-xs text-red-400 text-center">❤️ {p.likeCount}</span>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-gray-300 text-sm">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 페이지네이션 */}
          {tab === 'LIST' && total > 15 && (
            <div className="flex justify-center gap-1 mt-4">
              {Array.from({ length: Math.ceil(total / 15) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => loadPosts(p, category, sort, keyword)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽 사이드바 (데스크탑만) ── */}
        <div className="hidden lg:block w-64 shrink-0 space-y-4">
          {/* 글 작성 CTA */}
          {user ? (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm">
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_BADGE[user.role] ?? 'bg-gray-100'}`}>{ROLE_LABEL[user.role]}</span>
                </div>
              </div>
              <button onClick={() => setShowWrite(true)}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700">
                ✏️ 글 작성하기
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">로그인하고 커뮤니티에 참여하세요!</p>
              <Link href="/login" className="block w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700">로그인</Link>
            </div>
          )}

          {/* BEST 게시글 사이드 위젯 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
              <span>🔥</span> 인기 게시글
            </h3>
            <div className="space-y-2.5">
              {bestPosts.slice(0, 5).map((p, i) => (
                <Link key={p.id} href={`/community/${p.id}`} className="flex gap-2 items-start group">
                  <span className={`text-xs font-black w-4 shrink-0 ${i < 3 ? 'text-orange-500' : 'text-gray-300'}`}>{i + 1}</span>
                  <p className="text-xs text-gray-700 group-hover:text-purple-600 line-clamp-2 flex-1">{p.title}</p>
                </Link>
              ))}
              {bestPosts.length === 0 && <p className="text-xs text-gray-300">아직 게시글이 없습니다</p>}
            </div>
          </div>

          {/* 카테고리 통계 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">카테고리</h3>
            <div className="space-y-1.5">
              {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                <button key={c.key} onClick={() => { setCategory(c.key); setTab('LIST'); loadPosts(1, c.key, sort, keyword); }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${category === c.key ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 글 작성 모달 */}
      {showWrite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">게시글 작성</h2>
              <button onClick={() => setShowWrite(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>
            <form onSubmit={handleWrite} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
                  <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={writeForm.category} onChange={e => setWriteForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">작성자</label>
                  <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">{user?.name}</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={writeForm.title} onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
                <textarea required rows={8} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  value={writeForm.content} onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="내용을 입력하세요" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowWrite(false)}
                  className="px-5 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                  {submitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
