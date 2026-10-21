import { z } from 'zod';

// 빈 문자열은 "입력 안 함"으로 취급한다 (프론트 폼이 빈 값을 ''로 보냄)
const optionalText = (max: number) =>
  z.preprocess(v => (v === '' || v === null ? undefined : v), z.string().max(max).optional());

const httpUrl = z.string().max(2048).url().refine(v => /^https?:\/\//i.test(v), 'http/https URL만 허용됩니다');

/** 미션 생성 시 클라이언트가 지정할 수 있는 필드 (상태·결제·집계 필드는 서버가 정한다) */
export const missionFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  category: z.enum(['VISIT', 'SNS', 'REVIEW', 'VIDEO']),
  regionSi: z.string().trim().max(50),
  regionGu: z.string().trim().max(50),
  regionDong: optionalText(50),
  maxParticipants: z.coerce.number().int().min(1).max(1000),
  rewardAmount: z.coerce.number().min(0).max(100_000_000),
  rewardDescription: optionalText(5000),
  requirements: optionalText(5000),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  submissionDeadline: z.coerce.date(),
  thumbnailUrl: z.preprocess(v => (v === '' ? undefined : v), httpUrl.optional()),
});

const withDateOrder = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((v: z.infer<typeof missionFieldsSchema>, ctx) => {
    if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: '종료일은 시작일 이후여야 합니다' });
  });

export const operatorCreateMissionSchema = withDateOrder(
  missionFieldsSchema.extend({
    clientProfileId: z.preprocess(v => (v === '' ? undefined : v), z.string().uuid().optional()),
    sendPaymentLink: z.boolean().optional(),
  }),
);

export const payAndCreateMissionSchema = withDateOrder(
  missionFieldsSchema.extend({
    paymentKey: z.string().min(1).max(200),
    orderId: z.string().min(1).max(200),
    amount: z.coerce.number().int().positive(),
  }),
);

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
