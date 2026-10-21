import { randomBase62, TRACKING_CODE_LENGTH, TRACKING_CODE_PATTERN, randomCampaignCode } from '../../src/lib/random';
import { buildTrackedDestination, validateDestinationUrl } from '../../src/modules/tracking/destination';
import { detectBot, detectDevice, refererDomain, visitorHash } from '../../src/modules/tracking/visitor';
import { settingDefaults } from '../../src/modules/settings/settings';
import { kstDayKey } from '../../src/lib/clock';
import fs from 'fs';
import path from 'path';

describe('추적 코드 추측 불가능성 (필수 3)', () => {
  const codes = Array.from({ length: 20000 }, () => randomBase62(TRACKING_CODE_LENGTH));

  it('produces 12-char base62 codes with no collisions in 20k samples', () => {
    expect(codes.every(c => TRACKING_CODE_PATTERN.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('carries ~71 bits of entropy (62^12) — far beyond what the redirect rate limit allows to brute-force', () => {
    expect(Math.log2(62 ** TRACKING_CODE_LENGTH)).toBeGreaterThan(70);
  });

  it('has no sequential structure: consecutive codes share no common prefix beyond chance', () => {
    let shared = 0;
    for (let i = 1; i < 2000; i++) if (codes[i].slice(0, 3) === codes[i - 1].slice(0, 3)) shared++;
    expect(shared).toBeLessThan(3); // 기대값 2000/62^3 ≈ 0.008
  });

  it('uses every base62 character roughly uniformly (no modulo bias)', () => {
    const counts = new Map<string, number>();
    for (const c of codes) for (const ch of c) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(62);
    const expected = (codes.length * TRACKING_CODE_LENGTH) / 62;
    for (const n of counts.values()) expect(Math.abs(n - expected) / expected).toBeLessThan(0.1);
  });

  it('draws from crypto.randomBytes, not Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    randomBase62(TRACKING_CODE_LENGTH);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const source = fs.readFileSync(path.join(__dirname, '../../src/lib/random.ts'), 'utf8');
    expect(source).toMatch(/import \{ randomBytes \} from 'crypto'/);
    expect(source).not.toMatch(/Math\.random/);
  });

  it('campaign codes are 8 lowercase alphanumerics', () => {
    expect(randomCampaignCode()).toMatch(/^[0-9a-z]{8}$/);
  });
});

describe('도착 URL 검증 (필수 4 — 등록 단계)', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/file',
    'file:///etc/passwd',
    '//evil.com',
    'https://user:pass@example.com/',
    'https://example.com/ path',
    'https://exa\nmple.com',
    'http://localhost',
    'not a url',
    '',
  ])('rejects %p', input => {
    expect(validateDestinationUrl(input).ok).toBe(false);
  });

  it.each([
    'https://smartstore.naver.com/shop/products/123',
    'http://example.co.kr/reserve?x=1#top',
    'https://booking.naver.com/booking/6/bizes/1',
  ])('accepts %p', input => {
    expect(validateDestinationUrl(input).ok).toBe(true);
  });
});

describe('UTM 부착', () => {
  it('keeps existing query/hash and overwrites utm_* parameters', () => {
    const out = new URL(buildTrackedDestination('https://shop.example.com/p?id=7&utm_source=old#reviews', 'ab12cd34', 'Code12345678'));
    expect(out.searchParams.get('id')).toBe('7');
    expect(out.searchParams.get('utm_source')).toBe('mombridge');
    expect(out.searchParams.get('utm_medium')).toBe('blog');
    expect(out.searchParams.get('utm_campaign')).toBe('ab12cd34');
    expect(out.searchParams.get('utm_content')).toBe('Code12345678');
    expect(out.searchParams.getAll('utm_source')).toHaveLength(1);
    expect(out.hash).toBe('#reviews');
  });
});

describe('방문자 판정', () => {
  const rules = settingDefaults['click.botRules'];

  it.each([
    ['Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)', 'naver-yeti'],
    ['facebookexternalhit/1.1', 'facebook-preview'],
    ['kakaotalk-scrap/1.0', 'generic-bot'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'generic-bot'],
    ['curl/8.0.1', 'http-client'],
    ['', 'empty-ua'],
  ])('detects %p as a bot', (ua, rule) => {
    expect(detectBot(ua, 'GET', rules)).toBe(rule);
  });

  it('treats HEAD requests as bots and normal browsers as humans', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
    expect(detectBot(chrome, 'HEAD', rules)).toBe('head-request');
    expect(detectBot(chrome, 'GET', rules)).toBeNull();
  });

  it('classifies devices', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBe('MOBILE');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 14; SM-S918N) Mobile Safari/537.36 NAVER(inapp; blog)')).toBe('MOBILE');
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15')).toBe('PC');
    expect(detectDevice('SomethingElse/1.0')).toBe('UNKNOWN');
  });

  it('keeps only the referer host', () => {
    expect(refererDomain('https://m.blog.naver.com/user/223456789?x=secret')).toBe('m.blog.naver.com');
    expect(refererDomain('garbage')).toBeNull();
    expect(refererDomain(undefined)).toBeNull();
  });

  it('hashes visitors per day so different days cannot be linked, and never contains the IP', () => {
    const d1 = kstDayKey(new Date('2026-10-21T03:00:00Z'));
    const d2 = kstDayKey(new Date('2026-10-22T03:00:00Z'));
    const a = visitorHash('s'.repeat(32), d1, '203.0.113.7', 'UA');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203.0.113.7');
    expect(visitorHash('s'.repeat(32), d1, '203.0.113.7', 'UA')).toBe(a);
    expect(visitorHash('s'.repeat(32), d2, '203.0.113.7', 'UA')).not.toBe(a);
    expect(visitorHash('t'.repeat(32), d1, '203.0.113.7', 'UA')).not.toBe(a);
  });

  it('computes the KST day boundary', () => {
    expect(kstDayKey(new Date('2026-10-21T14:59:59Z')).toISOString()).toBe('2026-10-21T00:00:00.000Z');
    expect(kstDayKey(new Date('2026-10-21T15:00:00Z')).toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });
});
