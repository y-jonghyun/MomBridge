'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomTabBar, BottomTabBarSpacer, SiteHeader } from '@/components/ui';
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
  OPERATOR: 'bg-clay-tint text-ink-2',
  PARTICIPANT: 'bg-sage-tint text-sage',
  CLIENT: 'bg-clay-tint text-clay-dark',
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
    <div className="min-h-screen bg-cream">
      <SiteHeader showSearch={false} />

      <div className="mx-auto max-w-shell">
        <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-3.5">
          <h1 className="font-serif text-title font-bold">커뮤니티</h1>
          {user ? (
            <button
              onClick={() => setShowWrite(true)}
              className="flex h-11 shrink-0 items-center rounded-control bg-clay px-4 text-sm font-bold text-paper"
            >
              글 작성
            </button>
          ) : (
            <Link href="/login" className="flex h-11 items-center px-2 text-sm font-medium text-ink-2">로그인</Link>
          )}
        </header>

        {/* 카테고리 탭 — 스크롤은 되되 스크롤바는 숨긴다 */}
        <nav aria-label="게시판 분류" className="no-scrollbar flex gap-[22px] overflow-x-auto border-b border-line px-5">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => { setCategory(c.key); loadPosts(1, c.key, sort, keyword); }}
              aria-current={category === c.key ? 'page' : undefined}
              className={`-mb-px shrink-0 whitespace-nowrap py-3 text-sm ${category === c.key ? 'border-b-2 border-ink font-bold text-ink' : 'text-muted'}`}>
              {c.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 flex gap-5">

        {/* ── 왼쪽 메인 ── */}
        <div className="flex-1 min-w-0">

          {/* 탭 + 검색 + 정렬 */}
          {/* 검색은 한 줄 전체 폭으로, 탭과 정렬은 그 아래 줄로 */}
          <form onSubmit={handleSearch} className="mb-2.5 flex h-[52px] items-center gap-2.5 rounded-control-lg border border-line bg-paper px-4">
            <label htmlFor="community-q" className="sr-only">게시글 검색</label>
            <input
              id="community-q" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="게시글 검색"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
            <button type="submit" className="shrink-0 whitespace-nowrap text-[13px] font-medium text-clay">검색</button>
          </form>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {(['LIST', 'BEST', 'MY'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] ${tab === t ? 'bg-ink font-medium text-paper' : 'border border-line bg-paper text-ink-2'}`}>
                  {t === 'LIST' ? '전체' : t === 'BEST' ? 'BEST' : '내 글'}
                </button>
              ))}
            </div>

            <label className="flex shrink-0 items-center text-[13px] text-ink-2">
              <span className="sr-only">정렬</span>
              <select value={sort} onChange={e => { setSort(e.target.value as SortKey); loadPosts(1, category, e.target.value as SortKey, keyword); }}
                className="h-9 bg-transparent text-[13px] text-ink-2 outline-none">
                <option value="NEWEST">최신순</option>
                <option value="POPULAR">인기순</option>
                <option value="VIEWS">조회순</option>
              </select>
            </label>
          </div>

          {/* BEST 탭 */}
          {tab === 'BEST' && (
            <div className="space-y-3">
              {bestPosts.map((p, i) => (
                <Link key={p.id} href={`/community/${p.id}`}
                  className="bg-paper rounded-card p-4 flex gap-4 items-start hover: transition-all border border-line-soft hover:border-line block">
                  <div className={`text-2xl font-black w-8 text-center shrink-0 ${i === 0 ? 'text-clay' : i === 1 ? 'text-muted' : i === 2 ? 'text-clay' : 'text-muted'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-cream text-muted px-2 py-0.5 rounded-full">{p.category}</span>
                    </div>
                    <p className="font-semibold text-ink truncate">{p.title}</p>
                    <p className="text-sm text-muted line-clamp-1 mt-0.5">{p.content}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted">
                      <span>공감 {p._count?.likes ?? p.likeCount}</span>
                      <span>댓글 {p._count?.comments}</span>
                      <span>조회 {p.viewCount}</span>
                      <span>{p.user?.name}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {bestPosts.length === 0 && <div className="text-center py-20 text-muted bg-paper rounded-card">게시글이 없습니다</div>}
            </div>
          )}

          {/* 내 글 탭 */}
          {tab === 'MY' && !user && (
            <div className="text-center py-20 bg-paper rounded-card text-muted">
              <p className="mb-3">로그인 후 내 글을 확인할 수 있습니다</p>
              <Link href="/login" className="px-5 py-2 bg-ink text-paper rounded-control text-sm font-semibold">로그인</Link>
            </div>
          )}

          {/* 게시글 목록 테이블 */}
          {(tab === 'LIST' || (tab === 'MY' && user)) && (
            <div className="bg-paper rounded-card overflow-hidden border border-line-soft">
              {loading && (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-ink border-t-transparent rounded-full animate-spin border-4" />
                </div>
              )}
              {/* 모바일: 카드형 */}
              {!loading && (
                <div className="lg:hidden divide-y">
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-cream">
                      <span className="text-xs bg-cream text-muted px-2 py-0.5 rounded-full shrink-0 mt-0.5 min-w-[56px] text-center">{p.category}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink line-clamp-2">{p.title}</p>
                        <p className="text-xs text-muted mt-1">{p.user?.name} · {timeAgo(p.createdAt)} · 조회 {p.viewCount} · 공감 {p.likeCount}</p>
                      </div>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-muted text-sm">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
                  )}
                </div>
              )}
              {/* 데스크탑: 테이블형 */}
              {!loading && (
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-2.5 bg-cream border-b text-xs font-semibold text-muted">
                    <span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span className="text-center">조회</span><span className="text-center">좋아요</span>
                  </div>
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`}
                      className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-3 border-b last:border-0 hover:bg-cream transition-colors items-center group">
                      <span className="text-xs bg-cream text-muted px-2 py-0.5 rounded-full truncate">{p.category}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-ink group-hover:text-ink-2 line-clamp-1">{p.title}</span>
                        {p._count?.comments > 0 && <span className="text-xs text-muted ml-1.5">[{p._count.comments}]</span>}
                      </div>
                      <span className="text-xs text-muted truncate">{p.user?.name}</span>
                      <span className="text-xs text-muted">{timeAgo(p.createdAt)}</span>
                      <span className="text-xs text-muted text-center">{p.viewCount}</span>
                      <span className="text-xs text-clay-dark text-center">공감 {p.likeCount}</span>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-muted text-sm">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
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
                  className={`w-8 h-8 rounded-control text-sm font-medium transition-colors ${page === p ? 'bg-ink text-paper' : 'bg-paper text-ink-2 hover:bg-cream border'}`}>
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
            <div className="bg-paper rounded-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-clay-tint rounded-full flex items-center justify-center text-ink-2 font-bold text-sm">
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{user.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_BADGE[user.role] ?? 'bg-cream'}`}>{ROLE_LABEL[user.role]}</span>
                </div>
              </div>
              <button onClick={() => setShowWrite(true)}
                className="w-full py-2.5 bg-ink text-paper rounded-control text-sm font-bold hover:bg-ink">
                글 작성하기
              </button>
            </div>
          ) : (
            <div className="bg-paper rounded-card p-4 text-center">
              <p className="text-sm text-muted mb-3">로그인하고 커뮤니티에 참여하세요!</p>
              <Link href="/login" className="block w-full py-2.5 bg-ink text-paper rounded-control text-sm font-bold hover:bg-ink">로그인</Link>
            </div>
          )}

          {/* BEST 게시글 사이드 위젯 */}
          <div className="bg-paper rounded-card p-4">
            <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-1.5">
              인기 게시글
            </h3>
            <div className="space-y-2.5">
              {bestPosts.slice(0, 5).map((p, i) => (
                <Link key={p.id} href={`/community/${p.id}`} className="flex gap-2 items-start group">
                  <span className={`text-xs font-black w-4 shrink-0 ${i < 3 ? 'text-clay' : 'text-muted'}`}>{i + 1}</span>
                  <p className="text-xs text-ink-2 group-hover:text-ink-2 line-clamp-2 flex-1">{p.title}</p>
                </Link>
              ))}
              {bestPosts.length === 0 && <p className="text-xs text-muted">아직 게시글이 없습니다</p>}
            </div>
          </div>

          {/* 카테고리 통계 */}
          <div className="bg-paper rounded-card p-4">
            <h3 className="text-sm font-bold text-ink mb-3">카테고리</h3>
            <div className="space-y-1.5">
              {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                <button key={c.key} onClick={() => { setCategory(c.key); setTab('LIST'); loadPosts(1, c.key, sort, keyword); }}
                  className={`w-full text-left px-3 py-1.5 rounded-control text-sm transition-colors ${category === c.key ? 'bg-cream text-ink-2 font-semibold' : 'text-ink-2 hover:bg-cream'}`}>
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
          <div className="bg-paper rounded-box w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-ink">게시글 작성</h2>
              <button onClick={() => setShowWrite(false)} className="text-muted hover:text-ink-2 text-xl">×</button>
            </div>
            <form onSubmit={handleWrite} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">카테고리 *</label>
                  <select required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                    value={writeForm.category} onChange={e => setWriteForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">작성자</label>
                  <div className="border rounded-control px-3 py-2 text-sm bg-cream text-muted">{user?.name}</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">제목 *</label>
                <input required className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none"
                  value={writeForm.title} onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">내용 *</label>
                <textarea required rows={8} className="w-full border rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-ink focus:outline-none resize-none"
                  value={writeForm.content} onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="내용을 입력하세요" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowWrite(false)}
                  className="px-5 py-2.5 border rounded-control text-sm text-ink-2 hover:bg-cream">취소</button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2.5 bg-ink text-paper rounded-control text-sm font-bold hover:bg-ink disabled:opacity-50">
                  {submitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BottomTabBarSpacer />
      <BottomTabBar />
    </div>
  );
}
