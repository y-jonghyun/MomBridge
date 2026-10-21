import type { NaverBlogPostRef } from './naver-blog-url';

export interface FetchedPost {
  status: number;
  html: string;
}

/** 게시글 조회 어댑터. 제출(재제출) 1건당 1회만 호출한다 — 대량 조회 금지 */
export interface PostFetcher {
  fetchPost(ref: NaverBlogPostRef): Promise<FetchedPost>;
}

const MAX_BYTES = 2 * 1024 * 1024;

export class NaverBlogPostFetcher implements PostFetcher {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchPost(ref: NaverBlogPostRef): Promise<FetchedPost> {
    // 블로그 본문은 iframe 안의 PostView 페이지에 있다 (robots.txt의 User-agent: * 기준 허용 경로)
    const url = `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(ref.blogId)}&logNo=${encodeURIComponent(ref.logNo)}`;
    const res = await this.fetchImpl(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MomBridgeReviewCheck/1.0; one-time check of a submitted post)',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, html: '' };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    return { status: res.status, html: Buffer.concat(chunks).toString('utf8') };
  }
}

let fetcher: PostFetcher = new NaverBlogPostFetcher();

export function setPostFetcher(next: PostFetcher): void { fetcher = next; }
export function getPostFetcher(): PostFetcher { return fetcher; }
