'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const ROLE_LABEL: Record<string, string> = { OPERATOR: '운영자', PARTICIPANT: '참여자', CLIENT: '고객사' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export default function CommunityPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    api.get(`/community/posts/${id}`)
      .then(r => {
        setPost(r.data.data);
        setLikeCount(r.data.data.likeCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLike() {
    if (!user) { router.push('/login'); return; }
    try {
      const r = await api.post(`/community/posts/${id}/like`);
      setLiked(r.data.liked);
      setLikeCount(prev => r.data.liked ? prev + 1 : prev - 1);
    } catch { }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      const r = await api.post(`/community/posts/${id}/comments`, { content: comment });
      setPost((prev: any) => ({ ...prev, comments: [...(prev.comments ?? []), r.data.data] }));
      setComment('');
    } catch { } finally { setSubmittingComment(false); }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('댓글을 삭제할까요?')) return;
    try {
      await api.delete(`/community/posts/${id}/comments/${commentId}`);
      setPost((prev: any) => ({ ...prev, comments: prev.comments.filter((c: any) => c.id !== commentId) }));
    } catch { }
  }

  async function handleDeletePost() {
    if (!confirm('게시글을 삭제할까요?')) return;
    try {
      await api.delete(`/community/posts/${id}`);
      router.push('/community');
    } catch { }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border border-ink border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!post) return (
    <div className="min-h-screen flex items-center justify-center text-muted text-sm">게시글을 찾을 수 없습니다</div>
  );

  const isOwner = user?.id === post.user?.id;
  const isOperator = user?.role === 'OPERATOR';

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="bg-cream border-b border-line sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/community" className="text-muted hover:text-ink text-[12px]">← 목록</Link>
          <span className="text-line">|</span>
          <Link href="/" className="font-serif italic text-base">맘브릿지 커뮤니티</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* 게시글 본문 */}
        <div className="bg-white border border-line overflow-hidden">
          {/* 카테고리 + 제목 */}
          <div className="p-6 border-b border-line">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-muted bg-white border border-line px-2.5 py-1">{post.category}</span>
            </div>
            <h2 className="text-xl leading-snug mb-5">{post.title}</h2>

            {/* 작성자 + 메타 정보 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sand rounded-full flex items-center justify-center font-serif italic text-sm">
                  {post.user?.name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px]">{post.user?.name}</span>
                    <span className="text-[11px] text-muted">
                      {ROLE_LABEL[post.user?.role] ?? post.user?.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>·</span>
                    <span>조회 {post.viewCount}</span>
                  </div>
                </div>
              </div>

              {(isOwner || isOperator) && (
                <button onClick={handleDeletePost} className="text-[11px] text-muted hover:text-ink bg-white border border-line px-2.5 py-1">삭제</button>
              )}
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="p-6">
            <p className="text-[13px] leading-relaxed whitespace-pre-line">{post.content}</p>
          </div>

          {/* 좋아요 */}
          <div className="px-6 pb-6 flex items-center gap-4">
            <button onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 border text-[12px] tracking-wide transition-colors ${liked ? 'border-ink bg-ink text-cream' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
              <span>좋아요</span>
              <span>{likeCount}</span>
            </button>
            <span className="text-[12px] text-muted">댓글 {post.comments?.length ?? 0}</span>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="bg-white border border-line overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line bg-sand">
            <h3 className="text-[12px] tracking-widest2 text-muted">댓글 {post.comments?.length ?? 0}</h3>
          </div>

          {(post.comments ?? []).length === 0 && (
            <div className="py-10 text-center text-muted text-[13px]">첫 번째 댓글을 남겨보세요!</div>
          )}

          {(post.comments ?? []).map((c: any) => (
            <div key={c.id} className="px-5 py-4 border-b border-line last:border-0 flex gap-3">
              <div className="w-8 h-8 bg-sand rounded-full flex items-center justify-center font-serif italic text-xs shrink-0">
                {c.user?.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px]">{c.user?.name}</span>
                  <span className="text-[11px] text-muted">
                    {ROLE_LABEL[c.user?.role] ?? c.user?.role}
                  </span>
                  <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[13px] whitespace-pre-line">{c.content}</p>
              </div>
              {(user?.id === c.userId || isOperator) && (
                <button onClick={() => handleDeleteComment(c.id)}
                  className="text-[11px] text-muted hover:text-ink shrink-0 self-start mt-1">삭제</button>
              )}
            </div>
          ))}

          {/* 댓글 작성 */}
          {user ? (
            <form onSubmit={handleComment} className="p-4 border-t border-line bg-sand flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-serif italic text-xs shrink-0 bg-white border border-line">
                {user.name[0]}
              </div>
              <div className="flex-1 flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  className="flex-1 bg-white border border-line px-3 py-2 text-[13px] outline-none focus:border-ink"
                  placeholder="댓글을 입력하세요" />
                <button type="submit" disabled={submittingComment || !comment.trim()} className="btn-outline py-2 px-4 shrink-0 disabled:opacity-50">
                  {submittingComment ? '...' : '등록'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 border-t border-line text-center">
              <Link href="/login" className="text-[12px] text-ink border-b border-ink">로그인 후 댓글 작성</Link>
            </div>
          )}
        </div>

        {/* 목록으로 */}
        <div className="flex justify-center">
          <Link href="/community" className="btn-outline">← 목록으로</Link>
        </div>
      </div>
    </div>
  );
}
