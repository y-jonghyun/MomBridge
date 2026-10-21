import { createHmac } from 'crypto';
import { KeywordToolAdapter, KeywordToolError, KeywordToolRateLimitError, RawRelKeyword } from './keyword-tool';

const BASE_URL = 'https://api.searchad.naver.com';
const URI = '/keywordstool';

/**
 * 네이버 검색광고 API 키워드 도구.
 * 인증: X-Signature = Base64(HMAC-SHA256(secretKey, `${timestamp}.${method}.${uri}`))
 * 키·서명·응답 본문은 로그에 남기지 않는다.
 */
export class NaverSearchAdAdapter implements KeywordToolAdapter {
  readonly source = 'naver' as const;

  constructor(
    private readonly apiKey: string,
    private readonly secretKey: string,
    private readonly customerId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  signature(timestamp: string, method: string, uri: string): string {
    return createHmac('sha256', this.secretKey).update(`${timestamp}.${method}.${uri}`).digest('base64');
  }

  async fetchRelated(hints: string[]): Promise<RawRelKeyword[]> {
    const timestamp = String(Date.now());
    const params = new URLSearchParams({ hintKeywords: hints.join(','), showDetail: '1' });
    const res = await this.fetchImpl(`${BASE_URL}${URI}?${params}`, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': this.apiKey,
        'X-Customer': this.customerId,
        'X-Signature': this.signature(timestamp, 'GET', URI),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 429) throw new KeywordToolRateLimitError();
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { code?: unknown };
      throw new KeywordToolError(res.status, body.code != null ? String(body.code) : undefined);
    }
    const body = await res.json() as { keywordList?: unknown };
    return Array.isArray(body.keywordList) ? body.keywordList as RawRelKeyword[] : [];
  }
}
