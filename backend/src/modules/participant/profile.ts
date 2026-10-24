import { z } from 'zod';

/**
 * 참여자 프로필 완성 규칙.
 *
 * 미션에 지원하려면 '활동 지역'과 'SNS 계정 하나 이상'이 있어야 한다.
 * 자녀 연령대는 선택 항목이라 완성 여부에 넣지 않는다.
 */

export type SnsPlatform = 'NAVER_BLOG' | 'INSTAGRAM' | 'YOUTUBE';

/** 플랫폼별로 주소가 어느 집에서 왔는지 본다 */
const HOSTS: Record<SnsPlatform, { label: string; hosts: string[]; example: string }> = {
  NAVER_BLOG: {
    label: '네이버 블로그',
    hosts: ['blog.naver.com', 'm.blog.naver.com'],
    example: 'https://blog.naver.com/아이디',
  },
  INSTAGRAM: {
    label: '인스타그램',
    hosts: ['instagram.com', 'www.instagram.com'],
    example: 'https://instagram.com/아이디',
  },
  YOUTUBE: {
    label: '유튜브',
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
    example: 'https://youtube.com/@아이디',
  },
};

export const snsPlatformLabel = (platform: string) => HOSTS[platform as SnsPlatform]?.label ?? platform;

/** 주소에서 보여 줄 이름(아이디)을 뽑는다. 못 뽑으면 호스트 이름 */
function readHandle(url: URL): string {
  const first = url.pathname.split('/').filter(Boolean)[0];
  return (first ?? url.hostname).slice(0, 200);
}

/**
 * SNS 계정 입력. 플랫폼과 주소가 서로 맞는지까지 본다.
 * 통과하면 저장할 모양({ platform, url, handle })으로 바꿔 준다.
 */
export const snsAccountSchema = z.object({
  platform: z.enum(['NAVER_BLOG', 'INSTAGRAM', 'YOUTUBE'], { error: '블로그·인스타그램·유튜브 중에서 골라 주세요' }),
  url: z.string().trim().min(1, '채널 주소를 입력해 주세요').max(2048),
}).transform((input, ctx) => {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    ctx.addIssue({ code: 'custom', path: ['url'], message: '주소를 https://로 시작해 전체로 적어 주세요' });
    return z.NEVER;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    ctx.addIssue({ code: 'custom', path: ['url'], message: '주소를 https://로 시작해 전체로 적어 주세요' });
    return z.NEVER;
  }

  const spec = HOSTS[input.platform];
  const host = parsed.hostname.toLowerCase();
  if (!spec.hosts.includes(host)) {
    ctx.addIssue({
      code: 'custom',
      path: ['url'],
      message: `${spec.label} 주소가 아니에요. 예: ${spec.example}`,
    });
    return z.NEVER;
  }

  // 채널 주소에 아이디가 없으면(예: https://instagram.com) 누구 채널인지 알 수 없다
  if (!parsed.pathname.split('/').filter(Boolean).length) {
    ctx.addIssue({
      code: 'custom',
      path: ['url'],
      message: `내 채널 주소를 적어 주세요. 예: ${spec.example}`,
    });
    return z.NEVER;
  }

  return { platform: input.platform, url: parsed.toString(), handle: readHandle(parsed) };
});

/** 미션에 지원할 수 있는 상태인지 */
export function isProfileComplete(
  profile: { regionSi: string; regionGu: string },
  snsAccounts: { id: string }[],
): boolean {
  return !!profile.regionSi.trim() && !!profile.regionGu.trim() && snsAccounts.length > 0;
}

/** 무엇이 비었는지 — 화면이 안내 문구를 만들 때 쓴다 */
export function missingProfileParts(
  profile: { regionSi: string; regionGu: string },
  snsAccounts: { id: string }[],
): string[] {
  const missing: string[] = [];
  if (!profile.regionSi.trim() || !profile.regionGu.trim()) missing.push('활동 지역');
  if (snsAccounts.length === 0) missing.push('SNS 계정');
  return missing;
}
