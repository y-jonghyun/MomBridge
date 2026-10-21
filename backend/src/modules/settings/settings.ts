import { z } from 'zod';
import { prisma } from '../../config/database';

/**
 * 운영 설정값. 코드 기본값 위에 platform_settings 테이블 값을 덮어쓴다.
 * 비밀값(API 키, 해시 비밀값)은 여기 두지 않고 env에만 둔다.
 */

const regexString = z.string().min(1).max(300).refine(v => {
  try { new RegExp(v, 'i'); return true; } catch { return false; }
}, '올바른 정규식이 아닙니다');

export const settingSchemas = {
  'keyword.cacheTtlDays': z.number().int().min(1).max(90),
  'keyword.sort': z.object({
    mode: z.enum(['recommended', 'volume', 'competition']),
    volumeBand: z.tuple([z.number().int().min(0), z.number().int().min(1)]),
    weights: z.object({
      band: z.number().min(0).max(1),
      competition: z.number().min(0).max(1),
      regionCategory: z.number().min(0).max(1),
    }),
  }),
  'keyword.maxSubKeywords': z.number().int().min(0).max(10),
  'click.retentionDays': z.number().int().min(7).max(730),
  'click.botRules': z.array(z.object({ name: z.string().min(1).max(50), pattern: regexString })).max(100),
  'click.rateLimit': z.object({
    perVisitorPerLinkPerMin: z.number().int().min(1).max(1000),
    perIpPerMin: z.number().int().min(1).max(10000),
  }),
  'submission.disclosurePhrases': z.array(regexString).min(1).max(50),
  'submission.disclosureTopChars': z.number().int().min(50).max(2000),
  'report.shareMaxDays': z.number().int().min(1).max(365),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

export const settingDefaults: { [K in SettingKey]: SettingValue<K> } = {
  'keyword.cacheTtlDays': 7,
  'keyword.sort': {
    mode: 'recommended',
    volumeBand: [100, 5000],
    weights: { band: 0.4, competition: 0.35, regionCategory: 0.25 },
  },
  'keyword.maxSubKeywords': 5,
  'click.retentionDays': 90,
  'click.botRules': [
    { name: 'generic-bot', pattern: 'bot|crawl|spider|slurp|scrap' },
    { name: 'naver-yeti', pattern: 'Yeti' },
    { name: 'kakao-preview', pattern: 'kakaotalk-scrap|kakaostory-og-reader' },
    { name: 'facebook-preview', pattern: 'facebookexternalhit|facebookcatalog' },
    { name: 'messenger-preview', pattern: 'Slackbot|Twitterbot|Discordbot|TelegramBot|WhatsApp|LinkedInBot|Line/' },
    { name: 'headless', pattern: 'HeadlessChrome|PhantomJS|Puppeteer|Playwright' },
    { name: 'http-client', pattern: '^(curl|wget|python-requests|python-urllib|Go-http-client|okhttp|axios|node-fetch|undici|Java/)' },
  ],
  'click.rateLimit': { perVisitorPerLinkPerMin: 10, perIpPerMin: 120 },
  // 공정위 심사지침상 '체험단', '선물', '~에서 보내주셨어요' 등은 명확한 표시로 보지 않으므로 넣지 않는다
  'submission.disclosurePhrases': [
    '소정의\\s*(원고료|고료|활동비)',
    '원고료\\s*를?\\s*(지원|제공|지급)\\s*받',
    '(제품|상품|서비스|식사|이용권|숙박)\\s*(을|를)?\\s*(무상|무료)\\s*(으로|로)?\\s*(제공|지원)\\s*받',
    '(제품|상품|서비스|식사|이용권|숙박)\\s*(을|를)?\\s*(제공|지원|협찬)\\s*받',
    '(업체|광고주|브랜드)\\s*(로|으로)\\s*부터\\s*.{0,20}(제공|지원|협찬)\\s*받',
    '협찬\\s*(을|를)?\\s*받',
    '(금전적|경제적)\\s*(대가|지원)',
    '대가\\s*(를)?\\s*(받|지급|제공)',
    '#\\s*광고|\\[\\s*광고\\s*\\]|\\(\\s*광고\\s*\\)|유료\\s*광고',
  ],
  'submission.disclosureTopChars': 200,
  'report.shareMaxDays': 30,
};

/** 운영자 화면에서 편집할 수 있는 키 */
export const editableSettingKeys: SettingKey[] = ['keyword.sort', 'submission.disclosurePhrases', 'click.botRules'];

const CACHE_MS = 60_000;
const cache = new Map<SettingKey, { value: unknown; at: number }>();

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as SettingValue<K>;
  let value: SettingValue<K> = settingDefaults[key];
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    if (row) {
      const parsed = settingSchemas[key].safeParse(row.value);
      if (parsed.success) value = parsed.data as SettingValue<K>;
    }
  } catch {
    // 설정 조회 실패 시 기본값으로 동작 (리다이렉트 등 핵심 경로를 막지 않음)
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting<K extends SettingKey>(key: K, value: unknown, updatedBy: string): Promise<SettingValue<K>> {
  const parsed = settingSchemas[key].parse(value) as SettingValue<K>;
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: parsed as object, updatedBy },
    update: { value: parsed as object, updatedBy },
  });
  cache.delete(key);
  return parsed;
}

export async function resetSetting(key: SettingKey): Promise<void> {
  await prisma.platformSetting.deleteMany({ where: { key } });
  cache.delete(key);
}

export function clearSettingsCache(): void {
  cache.clear();
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(settingSchemas, key);
}
