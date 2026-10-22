import { z } from 'zod';
import { normalizeProvince } from '../../lib/regions';
import { validateDestinationUrl } from '../tracking/destination';

// 빈 문자열은 "입력 안 함"으로 취급한다 (프론트 폼이 빈 값을 ''로 보냄)
const optionalText = (max: number) =>
  z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(max).optional());

const httpUrl = z.string().max(2048).url().refine(v => /^https?:\/\//i.test(v), 'http/https URL만 허용됩니다');

/** 광고주가 등록하는 도착 URL (추적 링크가 이동할 곳) */
export const destinationUrlSchema = z.string().transform((v, ctx) => {
  const r = validateDestinationUrl(v);
  if (!r.ok) { ctx.addIssue({ code: 'custom', message: r.reason }); return z.NEVER; }
  return r.url;
});

const keywordEntrySchema = z.object({
  keyword: z.string().trim().min(1).max(100),
  monthlyPcQc: z.number().int().min(0).nullable().optional(),
  monthlyMobileQc: z.number().int().min(0).nullable().optional(),
  isLowVolume: z.boolean().optional(),
  compIdx: z.enum(['low', 'mid', 'high', 'unknown']).optional(),
});

/** 확정 키워드: 메인 1개 + 서브 여러 개 (서브 최대 개수는 설정값으로 검사) */
export const missionKeywordsSchema = z.object({
  main: keywordEntrySchema,
  subs: z.array(keywordEntrySchema).max(10).default([]),
});
export type MissionKeywordsInput = z.infer<typeof missionKeywordsSchema>;

/** 미션 생성 시 클라이언트가 지정할 수 있는 필드 (상태·결제·집계 필드는 서버가 정한다) */
export const missionFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  category: z.enum(['VISIT', 'SNS', 'REVIEW', 'VIDEO']),
  // 시·도는 정식 명칭으로 저장 ('충북' → '충청북도'). 시·군·구('청주시')를 넣으면 거절 — 지역 필터가 시·도 단위라서
  regionSi: z.string().trim().max(50).transform((v, ctx) => {
    const name = normalizeProvince(v);
    if (!name) { ctx.addIssue({ code: 'custom', message: '시·도를 선택해 주세요 (예: 충청북도)' }); return z.NEVER; }
    return name;
  }),
  regionGu: z.string().trim().max(50),
  regionDong: optionalText(50),
  maxParticipants: z.coerce.number().int().min(1).max(1000),
  rewardAmount: z.coerce.number().min(0).max(100_000_000),
  rewardDescription: optionalText(5000),
  requirements: optionalText(5000),
  visitGuide: optionalText(2000),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  submissionDeadline: z.coerce.date(),
  thumbnailUrl: z.preprocess(v => (v === '' ? undefined : v), httpUrl.optional()),
  destinationUrl: z.preprocess(v => (v === '' || v === null ? undefined : v), destinationUrlSchema.optional()),
  keywords: missionKeywordsSchema.optional(),
});

const checkDateOrder = (v: { startDate: Date; endDate: Date }, ctx: z.RefinementCtx) => {
  if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: '종료일은 시작일 이후여야 합니다' });
};

export const operatorCreateMissionSchema = missionFieldsSchema.extend({
  clientProfileId: z.preprocess(v => (v === '' ? undefined : v), z.string().uuid().optional()),
  sendPaymentLink: z.boolean().optional(),
}).superRefine(checkDateOrder);

export const payAndCreateMissionSchema = missionFieldsSchema.extend({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().min(1).max(200),
  amount: z.coerce.number().int().positive(),
}).superRefine(checkDateOrder);

export const payExistingMissionSchema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z.string().min(1).max(200),
  amount: z.coerce.number().int().positive(),
});

export const missionStatusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEWING', 'CLOSED']),
});

/** 결제 금액 = 1인 보상 × 모집 인원 (프론트와 동일한 계산식) */
export function expectedMissionAmount(rewardAmount: number, maxParticipants: number): number {
  return Math.round(Number(rewardAmount) * Number(maxParticipants));
}
