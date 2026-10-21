import { ZodType, ZodTypeDef } from 'zod';
import { AppError } from './errorHandler';

/** 요청 본문을 스키마로 검증하고, 스키마에 정의된 필드만 남긴 값을 돌려준다 */
export function parseInput<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    throw new AppError('VALIDATION_ERROR', 400, field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}
