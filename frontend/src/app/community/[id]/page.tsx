'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const ROLE_BADGE: Record<string, string> = {
  OPERATOR: 'bg-indigo-100 text-indigo-700',
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
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!post) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 text-gray-400">게시글을 찾을 수 없습니다</div>
  );

  const isOwner = user?.id === post.user?.id;
  const isOperator = user?.role === 'OPERATOR';

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 */}
      <nav className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/community" className="text-gray-400 hover:text-gray-700 text-sm">← 목록</Link>
          <span className="text-gray-200">|</span>
          <h1 className="text-base font-bold text-slate-800">맘브릿지 커뮤니티</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* 게시글 본문 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          {/* 카테고리 + 제목 */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{post.category}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-snug mb-4">{post.title}</h2>

            {/* 작성자 + 메타 정보 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
                  {post.user?.name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{post.user?.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_BADGE[post.user?.role] ?? 'bg-gray-100'}`}>
                      {ROLE_LABEL[post.user?.role] ?? post.user?.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>·</span>
                    <span>조회 {post.viewCount}</span>
                  </div>
                </div>
              </div>

              {(isOwner || isOperator) && (
                <div className="flex gap-2">
                  <button onClick={handleDeletePost}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-50">삭제</button>
                </div>
              )}
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="p-6">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{post.content}</p>
          </div>

          {/* 좋아요 */}
          <div className="px-6 pb-5 flex items-center gap-4">
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all ${liked ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500 hover:bg-stone-50'}`}>
              <span>{liked ? '❤️' : '🤍'}</span>
              <span>좋아요</span>
              <span className="font-bold">{likeCount}</span>
            </button>
            <span className="text-sm text-gray-400">💬 댓글 {post.comments?.length ?? 0}</span>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-stone-50">
            <h3 className="text-sm font-bold text-gray-800">댓글 <span className="text-indigo-600">{post.comments?.length ?? 0}</span></h3>
          </div>

          {(post.comments ?? []).length === 0 && (
            <div className="py-10 text-center text-gray-300 text-sm">첫 번째 댓글을 남겨보세요!</div>
          )}

          {(post.comments ?? []).map((c: any) => (
            <div key={c.id} className="px-5 py-4 border-b last:border-0 flex gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs shrink-0">
                {c.user?.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{c.user?.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_BADGE[c.user?.role] ?? 'bg-gray-100'}`}>
                    {ROLE_LABEL[c.user?.role] ?? c.user?.role}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{c.content}</p>
              </div>
              {(user?.id === c.userId || isOperator) && (
                <button onClick={() => handleDeleteComment(c.id)}
                  className="text-xs text-gray-300 hover:text-red-400 shrink-0 self-start mt-1">삭제</button>
              )}
            </div>
          ))}

          {/* 댓글 작성 */}
          {user ? (
            <form onSubmit={handleComment} className="p-4 border-t bg-stone-50 flex gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                {user.name[0]}
              </div>
              <div className="flex-1 flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="댓글을 입력하세요" />
                <button type="submit" disabled={submittingComment || !comment.trim()}
                  className="px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                  {submittingComment ? '...' : '등록'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 border-t text-center">
              <Link href="/login" className="text-sm text-indigo-600 font-semibold hover:underline">로그인 후 댓글 작성</Link>
            </div>
          )}
        </div>

        {/* 목록으로 */}
        <div className="flex justify-center">
          <Link href="/community" className="px-6 py-2.5 border rounded-lg text-sm text-gray-600 bg-white hover:bg-stone-50 font-medium">← 목록으로</Link>
        </div>
      </div>
    </div>
  );
}
