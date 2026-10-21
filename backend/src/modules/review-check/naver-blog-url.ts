export interface NaverBlogPostRef {
  blogId: string;
  logNo: string;
  /** 정규화된 PC 주소 */
  canonicalUrl: string;
}

const BLOG_ID = /^[A-Za-z0-9_-]{1,50}$/;
const LOG_NO = /^\d{6,20}$/;
const HOSTS = new Set(['blog.naver.com', 'm.blog.naver.com']);

/**
 * 네이버 블로그 게시글 URL만 받는다.
 *  - https://blog.naver.com/{blogId}/{logNo}
 *  - https://m.blog.naver.com/{blogId}/{logNo}
 *  - https://(m.)blog.naver.com/PostView.naver?blogId=..&logNo=..  (.nhn 포함)
 * naver.me 단축 주소는 원본 주소를 알 수 없어 받지 않는다.
 */
export function parseNaverBlogUrl(input: string): NaverBlogPostRef | { error: string } {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return { error: '올바른 URL이 아닙니다' }; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'http/https 주소만 가능합니다' };
  const host = url.hostname.toLowerCase();
  if (host === 'naver.me') return { error: 'naver.me 단축 주소 대신 블로그 글의 원래 주소(blog.naver.com/...)를 넣어주세요' };
  if (!HOSTS.has(host)) return { error: '네이버 블로그 글 주소(blog.naver.com/아이디/글번호)만 제출할 수 있습니다' };

  let blogId: string | null = null;
  let logNo: string | null = null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 1 && /^PostView\.(naver|nhn)$/i.test(parts[0])) {
    blogId = url.searchParams.get('blogId');
    logNo = url.searchParams.get('logNo');
  } else if (parts.length === 2) {
    [blogId, logNo] = parts;
  }
  if (!blogId || !logNo || !BLOG_ID.test(blogId) || !LOG_NO.test(logNo)) {
    return { error: '블로그 글 하나의 주소를 넣어주세요 (blog.naver.com/아이디/글번호)' };
  }
  return { blogId, logNo, canonicalUrl: `https://blog.naver.com/${blogId}/${logNo}` };
}
