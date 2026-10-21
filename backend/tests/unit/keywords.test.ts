import { parseVolume, parseCompIdx, parseKeywordList, normalizeHints, cacheKeyFor } from '../../src/modules/keywords/keyword-parse';
import { rankKeywords, bandScore } from '../../src/modules/keywords/keyword-rank';
import { settingDefaults } from '../../src/modules/settings/settings';
import { NaverSearchAdAdapter } from '../../src/modules/keywords/naver-searchad.adapter';
import { KeywordToolRateLimitError } from '../../src/modules/keywords/keyword-tool';
import { createHmac } from 'crypto';

describe('키워드 응답 파싱 (필수 1)', () => {
  it.each([
    [1234, { value: 1234, low: false }],
    ['1234', { value: 1234, low: false }],
    ['1,234', { value: 1234, low: false }],
    ['< 10', { value: null, low: true }],
    ['<10', { value: null, low: true }],
    [7, { value: 7, low: true }],
    ['', { value: null, low: false }],
    [null, { value: null, low: false }],
    [undefined, { value: null, low: false }],
    ['abc', { value: null, low: false }],
    [-5, { value: null, low: false }],
  ])('parseVolume(%p)', (raw, expected) => {
    expect(parseVolume(raw)).toEqual(expected);
  });

  it.each([
    ['낮음', 'low'], ['low', 'low'], ['중간', 'mid'], ['mid', 'mid'], ['높음', 'high'], ['HIGH', 'high'],
    ['', 'unknown'], [undefined, 'unknown'], ['매우높음', 'unknown'],
  ])('parseCompIdx(%p) → %s', (raw, expected) => {
    expect(parseCompIdx(raw)).toBe(expected);
  });

  it('parses a mixed keyword list, estimating "<10" as 5 and skipping broken rows', () => {
    const rows = parseKeywordList([
      { relKeyword: '망원동카페', monthlyPcQcCnt: '< 10', monthlyMobileQcCnt: 340, compIdx: '낮음' },
      { relKeyword: '망원동카페', monthlyPcQcCnt: 1, monthlyMobileQcCnt: 1 }, // 중복
      { relKeyword: '', monthlyPcQcCnt: 1 },
      { monthlyPcQcCnt: 1 },
      null,
      'garbage',
      { relKeyword: '마포 브런치', monthlyPcQcCnt: '1,200', monthlyMobileQcCnt: '< 10', compIdx: 'high' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ keyword: '망원동카페', pc: { value: null, low: true }, mobile: { value: 340 }, estimatedTotal: 345, compIdx: 'low' });
    expect(rows[1]).toMatchObject({ keyword: '마포 브런치', estimatedTotal: 1205, compIdx: 'high' });
  });

  it('returns an empty list for a non-array response', () => {
    expect(parseKeywordList(undefined)).toEqual([]);
    expect(parseKeywordList({ keywordList: [] })).toEqual([]);
  });

  it('normalizes hints: removes spaces/commas, dedupes, keeps at most 5', () => {
    expect(normalizeHints(['마포 카페', '마포카페', 'a,b', '', '1', '2', '3', '4'])).toEqual(['마포카페', 'ab', '1', '2', '3']);
    expect(cacheKeyFor(['B', 'a'])).toBe(cacheKeyFor(['A', 'b']));
  });
});

describe('키워드 정렬', () => {
  const rows = parseKeywordList([
    { relKeyword: '카페', monthlyPcQcCnt: 90000, monthlyMobileQcCnt: 300000, compIdx: '높음' },
    { relKeyword: '망원동카페', monthlyPcQcCnt: 300, monthlyMobileQcCnt: 1500, compIdx: '낮음' },
    { relKeyword: '망원동 맛집', monthlyPcQcCnt: 800, monthlyMobileQcCnt: 2500, compIdx: '중간' },
    { relKeyword: '망원동카페추천', monthlyPcQcCnt: '< 10', monthlyMobileQcCnt: '< 10', compIdx: '낮음' },
  ]);
  const ctx = { regionTerms: ['서울', '망원동'], categoryTerms: ['카페'] };

  it('puts moderate-volume, low-competition region+category keywords first in recommended mode', () => {
    const ranked = rankKeywords(rows, ctx, settingDefaults['keyword.sort']);
    expect(ranked[0].keyword).toBe('망원동카페');
    expect(ranked[0].isRegionCategory).toBe(true);
    expect(ranked.find(r => r.keyword === '카페')!.isRegionCategory).toBe(false);
  });

  it('honours the configured sort mode', () => {
    const byVolume = rankKeywords(rows, ctx, { ...settingDefaults['keyword.sort'], mode: 'volume' });
    expect(byVolume[0].keyword).toBe('카페');
    const byComp = rankKeywords(rows, ctx, { ...settingDefaults['keyword.sort'], mode: 'competition' });
    expect(byComp[byComp.length - 1].keyword).toBe('카페');
  });

  it('scores the volume band', () => {
    expect(bandScore(500, [100, 5000])).toBe(1);
    expect(bandScore(10, [100, 5000])).toBeLessThan(1);
    expect(bandScore(5_000_000, [100, 5000])).toBe(0);
  });
});

describe('NaverSearchAdAdapter', () => {
  it('signs requests with HMAC-SHA256 over "timestamp.METHOD.uri" and sends the four auth headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ keywordList: [{ relKeyword: 'x' }] }), { status: 200 }));
    const adapter = new NaverSearchAdAdapter('key', 'secret', '123', fetchMock as unknown as typeof fetch);
    const list = await adapter.fetchRelated(['망원동카페', '브런치']);
    expect(list).toEqual([{ relKeyword: 'x' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://api.searchad.naver.com/keywordstool?');
    expect(new URL(url).searchParams.get('hintKeywords')).toBe('망원동카페,브런치');
    expect(new URL(url).searchParams.get('showDetail')).toBe('1');
    const h = init.headers as Record<string, string>;
    const expected = createHmac('sha256', 'secret').update(`${h['X-Timestamp']}.GET./keywordstool`).digest('base64');
    expect(h).toMatchObject({ 'X-API-KEY': 'key', 'X-Customer': '123', 'X-Signature': expected });
  });

  it('maps HTTP 429 to a rate-limit error', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    const adapter = new NaverSearchAdAdapter('k', 's', '1', fetchMock as unknown as typeof fetch);
    await expect(adapter.fetchRelated(['a'])).rejects.toBeInstanceOf(KeywordToolRateLimitError);
  });
});
