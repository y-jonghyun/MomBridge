import { z } from 'zod';
import { AppError } from './errorHandler';
import { userMessage } from '../lib/validation-messages';

/**
 * 요청 본문을 스키마로 검증하고, 스키마에 정의된 필드만 남긴 값을 돌려준다.
 *
 * 스키마를 통째로 제네릭으로 받아 결과 타입을 z.output으로 끌어낸다 —
 * zod 4에서 ZodType의 제네릭이 바뀌어(ZodTypeDef 삭제) 이 방식이 권장된다.
 * 오류 문구는 lib/validation-messages가 한국어로 만든다.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, userMessage(result.error.issues[0]));
  }
  return result.data;
}
