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
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="bg-cream border-b border-line sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="text-muted hover:text-ink text-[12px]">←</Link>
            <Link href="/" className="font-serif italic text-base">맘브릿지</Link>
            <span className="text-line">|</span>
            <span className="text-[12px] tracking-widest2 text-muted">COMMUNITY</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <button onClick={() => setShowWrite(true)} className="btn-outline py-2 px-4 text-[11px]">
                글 작성
              </button>
            )}
            {!user && (
              <Link href="/login" className="text-[11px] tracking-widest2">로그인</Link>
            )}
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="max-w-5xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => { setCategory(c.key); loadPosts(1, c.key, sort, keyword); }}
              className={`shrink-0 px-4 py-2.5 text-[12px] border-b transition-colors ${category === c.key ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 flex gap-8">

        {/* ── 왼쪽 메인 ── */}
        <div className="flex-1 min-w-0">

          {/* 탭 + 검색 + 정렬 */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex bg-white border border-line overflow-hidden">
              {(['LIST', 'BEST', 'MY'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-[12px] tracking-wide transition-colors ${tab === t ? 'bg-ink text-cream' : 'text-muted hover:bg-sand'}`}>
                  {t === 'LIST' ? '전체' : t === 'BEST' ? 'BEST' : '내 글'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="flex flex-1 min-w-0">
              <input
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="게시글 검색..."
                className="flex-1 bg-white border border-line px-3 py-2 text-[13px] outline-none focus:border-ink min-w-0"
              />
              <button type="submit" className="px-4 py-2 border border-l-0 border-line text-[12px] hover:bg-sand">검색</button>
            </form>

            <select value={sort} onChange={e => { setSort(e.target.value as SortKey); loadPosts(1, category, e.target.value as SortKey, keyword); }}
              className="bg-white border border-line px-3 py-2 text-[12px] outline-none">
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
                  className="bg-white border border-line p-5 flex gap-4 items-start hover:bg-sand/40 transition-colors block">
                  <div className="font-serif italic text-xl w-8 text-center shrink-0 text-muted">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] text-muted bg-white border border-line px-2 py-0.5">{p.category}</span>
                    </div>
                    <p className="text-[13px] truncate">{p.title}</p>
                    <p className="text-[12px] text-muted line-clamp-1 mt-0.5">{p.content}</p>
                    <div className="flex gap-3 mt-2 text-[11px] text-muted">
                      <span>좋아요 {p._count?.likes ?? p.likeCount}</span>
                      <span>댓글 {p._count?.comments}</span>
                      <span>조회 {p.viewCount}</span>
                      <span>{p.user?.name}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {bestPosts.length === 0 && <div className="text-center py-20 text-muted bg-white border border-line">게시글이 없습니다</div>}
            </div>
          )}

          {/* 내 글 탭 */}
          {tab === 'MY' && !user && (
            <div className="text-center py-20 bg-white border border-line text-muted">
              <p className="mb-4 text-[13px]">로그인 후 내 글을 확인할 수 있습니다</p>
              <Link href="/login" className="btn-solid inline-block">로그인</Link>
            </div>
          )}

          {/* 게시글 목록 테이블 */}
          {(tab === 'LIST' || (tab === 'MY' && user)) && (
            <div className="bg-white border border-line overflow-hidden">
              {loading && (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* 모바일: 카드형 */}
              {!loading && (
                <div className="lg:hidden divide-y divide-line">
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-sand/40">
                      <span className="text-[11px] text-muted bg-white border border-line px-2 py-0.5 shrink-0 mt-0.5 min-w-[56px] text-center">{p.category}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] line-clamp-2">{p.title}</p>
                        <p className="text-[11px] text-muted mt-1">{p.user?.name} · {timeAgo(p.createdAt)} · 조회 {p.viewCount} · 좋아요 {p.likeCount}</p>
                      </div>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-muted text-[13px]">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
                  )}
                </div>
              )}
              {/* 데스크탑: 테이블형 */}
              {!loading && (
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-2.5 bg-sand border-b border-line text-[11px] tracking-wide text-muted">
                    <span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span className="text-center">조회</span><span className="text-center">좋아요</span>
                  </div>
                  {(tab === 'LIST' ? posts : myPosts).map(p => (
                    <Link key={p.id} href={`/community/${p.id}`}
                      className="grid grid-cols-[80px_1fr_80px_70px_60px_60px] gap-2 px-4 py-3 border-b border-line last:border-0 hover:bg-sand/40 transition-colors items-center">
                      <span className="text-[11px] text-muted truncate">{p.category}</span>
                      <div className="min-w-0">
                        <span className="text-[13px] line-clamp-1">{p.title}</span>
                        {p._count?.comments > 0 && <span className="text-[11px] text-muted ml-1.5">[{p._count.comments}]</span>}
                      </div>
                      <span className="text-[11px] text-muted truncate">{p.user?.name}</span>
                      <span className="text-[11px] text-muted">{timeAgo(p.createdAt)}</span>
                      <span className="text-[11px] text-muted text-center">{p.viewCount}</span>
                      <span className="text-[11px] text-muted text-center">{p.likeCount}</span>
                    </Link>
                  ))}
                  {(tab === 'LIST' ? posts : myPosts).length === 0 && (
                    <div className="text-center py-16 text-muted text-[13px]">{tab === 'MY' ? '작성한 글이 없습니다' : '게시글이 없습니다'}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 페이지네이션 */}
          {tab === 'LIST' && total > 15 && (
            <div className="flex justify-center gap-3 mt-8 text-[13px]">
              {Array.from({ length: Math.ceil(total / 15) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => loadPosts(p, category, sort, keyword)}
                  className={`transition-colors ${page === p ? 'text-ink underline' : 'text-muted hover:text-ink'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽 사이드바 (데스크탑만) ── */}
        <div className="hidden lg:block w-64 shrink-0 space-y-6">
          {/* 글 작성 CTA */}
          {user ? (
            <div className="bg-white border border-line p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-sand rounded-full flex items-center justify-center font-serif italic text-sm">
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-[13px]">{user.name}</p>
                  <span className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
                </div>
              </div>
              <button onClick={() => setShowWrite(true)} className="btn-outline w-full py-2.5">
                글 작성하기
              </button>
            </div>
          ) : (
            <div className="bg-white border border-line p-5 text-center">
              <p className="text-[13px] text-muted mb-4">로그인하고 커뮤니티에 참여하세요!</p>
              <Link href="/login" className="btn-solid block w-full">로그인</Link>
            </div>
          )}

          {/* BEST 게시글 사이드 위젯 */}
          <div className="bg-white border border-line p-5">
            <h3 className="text-[12px] tracking-widest2 text-muted mb-4">인기 게시글</h3>
            <div className="space-y-3">
              {bestPosts.slice(0, 5).map((p, i) => (
                <Link key={p.id} href={`/community/${p.id}`} className="flex gap-2 items-start group">
                  <span className="font-serif italic text-sm w-4 shrink-0 text-muted">{i + 1}</span>
                  <p className="text-[12px] group-hover:text-muted line-clamp-2 flex-1">{p.title}</p>
                </Link>
              ))}
              {bestPosts.length === 0 && <p className="text-[12px] text-muted">아직 게시글이 없습니다</p>}
            </div>
          </div>

          {/* 카테고리 통계 */}
          <div className="bg-white border border-line p-5">
            <h3 className="text-[12px] tracking-widest2 text-muted mb-4">카테고리</h3>
            <div className="space-y-1">
              {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                <button key={c.key} onClick={() => { setCategory(c.key); setTab('LIST'); loadPosts(1, c.key, sort, keyword); }}
                  className={`w-full text-left px-1 py-1.5 text-[13px] transition-colors ${category === c.key ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 글 작성 모달 */}
      {showWrite && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <div className="bg-cream w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="font-serif italic text-lg">게시글 작성</h2>
              <button onClick={() => setShowWrite(false)} className="text-muted hover:text-ink text-xl">×</button>
            </div>
            <form onSubmit={handleWrite} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">카테고리 *</label>
                  <select required className="field-input"
                    value={writeForm.category} onChange={e => setWriteForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c.key !== 'ALL').map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">작성자</label>
                  <div className="field-input text-muted">{user?.name}</div>
                </div>
              </div>
              <div>
                <label className="field-label">제목 *</label>
                <input required className="field-input"
                  value={writeForm.title} onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="제목을 입력하세요" />
              </div>
              <div>
                <label className="field-label">내용 *</label>
                <textarea required rows={8} className="field-input resize-none"
                  value={writeForm.content} onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="내용을 입력하세요" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowWrite(false)} className="btn-outline py-2.5">취소</button>
                <button type="submit" disabled={submitting} className="btn-solid py-2.5 disabled:opacity-50">
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
