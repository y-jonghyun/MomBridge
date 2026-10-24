/**
 * 미션 수정에서 무엇을 고칠 수 있는지 정하는 규칙.
 *
 * - 운영자는 모든 항목을 고칠 수 있다. 단, 결제된 미션의 금액·인원은 결제와 어긋나므로 막고
 *   '결제 확인 필요'라고 알려 준다.
 * - 고객사는 본인 미션만, 신청을 받기 전에는 거의 다 고칠 수 있다.
 *   신청이 들어온 뒤에는 체험단원에게 불리한 변경을 막고 안내성 항목만 열어 둔다.
 *
 * 화면도 이 규칙을 읽어 잠금 표시와 이유를 보여 준다 (GET /missions/:id/edit).
 */

/** 수정 화면이 다루는 칸 */
export const EDITABLE_FIELDS = [
  'title', 'description', 'category', 'businessCategory',
  'regionSi', 'regionGu', 'regionDong', 'visitAddress',
  'startDate', 'endDate', 'announceDate', 'submissionDeadline',
  'rewardAmount', 'maxParticipants',
  'requirements', 'visitGuide', 'visitHours', 'momTags', 'destinationUrl',
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** 신청이 들어온 뒤에도 고객사가 고칠 수 있는 안내성 항목 */
const INFORMATIONAL: EditableField[] = [
  'description', 'requirements', 'visitGuide', 'visitHours',
  'visitAddress', 'regionDong', 'businessCategory', 'momTags', 'destinationUrl',
];

/** 더 좋아지는 쪽으로만 바꿀 수 있는 항목 (줄이거나 앞당기면 불리하다) */
const ONLY_BETTER: EditableField[] = ['rewardAmount', 'maxParticipants', 'endDate', 'announceDate', 'submissionDeadline'];

export interface MissionState {
  paymentStatus: string;
  applicationCount: number;
}

export interface FieldRule {
  /** 아예 못 고치는 칸 */
  locked: boolean;
  /** 값을 좋아지는 쪽으로만 바꿀 수 있는 칸 (늘리기·미루기만) */
  onlyBetter: boolean;
  /** 화면에 보여 줄 이유 */
  reason?: string;
}

const PAID_REASON = '결제된 금액·인원이라 바꿀 수 없어요. 바꿔야 하면 운영자에게 문의해 주세요';
const PAID_REASON_OPERATOR = '결제된 금액·인원입니다. 바꾸려면 결제 확인이 필요합니다';
const APPLIED_LOCK = '이미 신청한 분들이 보고 신청한 내용이라 바꿀 수 없어요';
const APPLIED_BETTER = '이미 신청한 분들이 있어 늘리거나 미루는 것만 할 수 있어요';

/** 칸 하나에 대한 규칙 */
export function ruleFor(field: EditableField, role: 'OPERATOR' | 'CLIENT', state: MissionState): FieldRule {
  const paid = state.paymentStatus === 'PAID';
  const applied = state.applicationCount > 0;

  // 결제된 미션의 금액·인원은 둘 다 막는다 (결제 금액 = 보상 × 인원이라 어긋난다)
  if (paid && (field === 'rewardAmount' || field === 'maxParticipants')) {
    return { locked: true, onlyBetter: false, reason: role === 'OPERATOR' ? PAID_REASON_OPERATOR : PAID_REASON };
  }

  if (role === 'OPERATOR') return { locked: false, onlyBetter: false };

  if (!applied) return { locked: false, onlyBetter: false };

  if (INFORMATIONAL.includes(field)) return { locked: false, onlyBetter: false };
  if (ONLY_BETTER.includes(field)) return { locked: false, onlyBetter: true, reason: APPLIED_BETTER };
  return { locked: true, onlyBetter: false, reason: APPLIED_LOCK };
}

/** 화면에 내려 줄 전체 규칙표 */
export function editRules(role: 'OPERATOR' | 'CLIENT', state: MissionState): Record<string, FieldRule> {
  return Object.fromEntries(EDITABLE_FIELDS.map(f => [f, ruleFor(f, role, state)]));
}

const LABEL: Record<EditableField, string> = {
  title: '미션 제목', description: '미션 설명', category: '미션 유형', businessCategory: '업종',
  regionSi: '시·도', regionGu: '시·군·구', regionDong: '동', visitAddress: '방문 주소',
  startDate: '신청 시작일', endDate: '신청 마감일', announceDate: '선정 발표일', submissionDeadline: '후기 마감일',
  rewardAmount: '보상 금액', maxParticipants: '모집 인원',
  requirements: '수행 조건', visitGuide: '방문·예약 안내', visitHours: '방문 가능 시간',
  momTags: '엄마 시간 태그', destinationUrl: '도착 URL',
};

export const fieldLabel = (field: EditableField) => LABEL[field];

/** 두 값이 같은지 (날짜·배열·숫자를 함께 다룬다) */
export function sameValue(before: unknown, after: unknown): boolean {
  if (before instanceof Date || after instanceof Date) {
    const a = before ? new Date(before as string).getTime() : null;
    const b = after ? new Date(after as string).getTime() : null;
    return a === b;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before ?? []) === JSON.stringify(after ?? []);
  }
  if (before !== null && after !== null && before !== undefined && after !== undefined
    && !Number.isNaN(Number(before)) && !Number.isNaN(Number(after))
    && (typeof before === 'number' || typeof after === 'number')) {
    return Number(before) === Number(after);
  }
  return (before ?? null) === (after ?? null);
}

/** 좋아지는 쪽으로 바뀌었는지 (늘리기·미루기) */
export function isBetter(field: EditableField, before: unknown, after: unknown): boolean {
  if (field === 'rewardAmount' || field === 'maxParticipants') {
    return Number(after) >= Number(before);
  }
  // 날짜는 미루는 것만
  const a = before ? new Date(before as string).getTime() : null;
  const b = after ? new Date(after as string).getTime() : null;
  if (a === null) return true;       // 비어 있던 값을 채우는 건 괜찮다
  if (b === null) return false;      // 있던 일정을 지우는 건 불리하다
  return b >= a;
}

/**
 * 체험단원에게 불리한 변경인지 — 보상·인원을 줄이거나 일정을 앞당기는 것.
 * 고객사는 규칙에서 이미 막히고, 운영자만 여기까지 올 수 있다.
 * (운영자는 막지 않는다. 대신 저장 전에 한 번 묻고 확인했다는 표시를 기록에 남긴다)
 */
export function isUnfavorable(field: EditableField, before: unknown, after: unknown): boolean {
  return ONLY_BETTER.includes(field) && !isBetter(field, before, after);
}

/** 기록에 붙는 확인 표시. 칸 이름과 겹치지 않게 밑줄로 시작한다 */
export const UNFAVORABLE_KEY = '_unfavorable';

/** 체험단원에게 알려야 하는 변경인지 — 일정·방문 안내·주소 */
export const NOTIFY_FIELDS: EditableField[] = [
  'startDate', 'endDate', 'announceDate', 'submissionDeadline',
  'visitGuide', 'visitHours', 'visitAddress',
];
