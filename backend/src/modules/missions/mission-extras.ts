import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { randomCampaignCode } from '../../lib/random';
import { getSetting } from '../settings/settings';
import type { MissionKeywordsInput } from './missions.schema';

/** 겹치지 않는 캠페인 코드(utm_campaign) */
export async function newCampaignCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomCampaignCode();
    if (!(await prisma.mission.findUnique({ where: { campaignCode: code }, select: { id: true } }))) return code;
  }
  throw new Error('could not allocate a campaign code');
}

/** 메인과 겹치거나 중복된 서브 키워드를 빼고, 서브 개수 상한(설정값)을 검사한다 */
export async function normalizeMissionKeywords(input: MissionKeywordsInput): Promise<MissionKeywordsInput> {
  const maxSubs = await getSetting('keyword.maxSubKeywords');
  const main = input.main.keyword;
  const subs = input.subs.filter((s, i, arr) => s.keyword !== main && arr.findIndex(x => x.keyword === s.keyword) === i);
  if (subs.length > maxSubs) throw new AppError('VALIDATION_ERROR', 400, `서브 키워드는 최대 ${maxSubs}개까지 선택할 수 있습니다`);
  return { main: input.main, subs };
}

/** 메인 1개 + 서브 키워드를 통째로 교체한다 */
export async function saveMissionKeywords(missionId: string, raw: MissionKeywordsInput): Promise<void> {
  const input = await normalizeMissionKeywords(raw);
  const subs = input.subs;

  const row = (k: MissionKeywordsInput['main'], role: 'MAIN' | 'SUB') => ({
    missionId,
    keyword: k.keyword,
    role,
    monthlyPcQc: k.monthlyPcQc ?? null,
    monthlyMobileQc: k.monthlyMobileQc ?? null,
    isLowVolume: k.isLowVolume ?? false,
    compIdx: k.compIdx ?? null,
  });
  await prisma.$transaction([
    prisma.missionKeyword.deleteMany({ where: { missionId } }),
    prisma.missionKeyword.createMany({ data: [row(input.main, 'MAIN'), ...subs.map(s => row(s, 'SUB'))] }),
  ]);
}

export async function getMissionKeywords(missionId: string) {
  const rows = await prisma.missionKeyword.findMany({ where: { missionId }, orderBy: [{ role: 'asc' }, { keyword: 'asc' }] });
  return { main: rows.find(r => r.role === 'MAIN') ?? null, subs: rows.filter(r => r.role === 'SUB') };
}
