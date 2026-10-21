/** 키워드 도구 응답 원본 (네이버 검색광고 RelKwdStat). 명세상 수치 필드도 string일 수 있다 */
export interface RawRelKeyword {
  relKeyword?: unknown;
  monthlyPcQcCnt?: unknown;
  monthlyMobileQcCnt?: unknown;
  compIdx?: unknown;
  [key: string]: unknown;
}

export interface KeywordToolAdapter {
  readonly source: 'naver' | 'mock';
  /** 힌트 키워드(최대 5개)로 연관 키워드를 조회한다 */
  fetchRelated(hints: string[]): Promise<RawRelKeyword[]>;
}

export class KeywordToolRateLimitError extends Error {
  constructor() { super('keyword tool rate limited'); this.name = 'KeywordToolRateLimitError'; }
}

export class KeywordToolError extends Error {
  constructor(public status: number, public code?: string) {
    super(`keyword tool failed (status ${status}${code ? `, code ${code}` : ''})`);
    this.name = 'KeywordToolError';
  }
}
