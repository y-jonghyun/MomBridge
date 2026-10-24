import { z } from 'zod';
import { ko } from 'zod/v4/locales';

type Issue = z.core.$ZodIssue;
/** 에러 맵이 받는 이슈 — 아직 message가 정해지기 전이라 message가 없다 */
type RawIssue = z.core.$ZodRawIssue;

/**
 * 검증 오류 문구를 한국어로 맞춘다.
 *
 * 1) zod 기본 로케일을 한국어로 켠다.
 * 2) 그래도 "string이 너무 큽니다" 처럼 타입 이름이 드러나는 문구가 남아서,
 *    사용자에게 보여 줄 문장으로 덮어쓴다.
 * 3) 스키마에 직접 적어 둔 문구(비밀번호 6자, 휴대폰 번호, 동의, 날짜 순서 등)는
 *    custom 메시지라 그대로 나간다.
 *
 * 이 파일을 import하는 것만으로 설정이 걸린다 (app.ts와 validate.ts가 불러온다).
 */

const koLocale = ko();

/**
 * zod의 문구 우선순위를 그대로 쓴다.
 *   스키마에 적어 둔 error  >  여기 customError  >  localeError(한국어)
 * 스키마가 문구를 가지고 있으면 customError는 아예 불리지 않는다 —
 * 그래서 "비밀번호는 6자 이상이어야 합니다" 같은 우리 문장은 저절로 보존된다.
 */
z.config({
  localeError: koLocale.localeError,
  customError: issue => {
    const text = friendlyMessage(issue);
    if (!text) return undefined; // 우리가 다루지 않는 종류는 한국어 기본 문구에 맡긴다
    const label = fieldLabel(issue.path ?? []);
    return label ? `${label}: ${text}` : text;
  },
});

/** 오류 앞에 붙일 필드 이름. 여기 없는 필드는 접두어 없이 문구만 보여 준다 */
const FIELD_LABELS: Record<string, string> = {
  // 계정·가입
  email: '이메일',
  password: '비밀번호',
  currentPassword: '현재 비밀번호',
  newPassword: '새 비밀번호',
  name: '이름',
  phone: '휴대폰 번호',
  role: '회원 유형',
  token: '인증 링크',
  agreements: '약관 동의',
  age14: '만 14세 이상 확인',
  terms: '이용약관 동의',
  privacy: '개인정보 수집·이용 동의',
  marketing: '마케팅 수신 동의',

  // 미션
  title: '미션 제목',
  description: '미션 설명',
  category: '미션 유형',
  businessCategory: '업종',
  momTags: '엄마 시간 태그',
  status: '상태',
  regionSi: '시·도',
  regionGu: '시·군·구',
  regionDong: '동',
  maxParticipants: '모집 인원',
  rewardAmount: '보상 금액',
  rewardDescription: '보상 설명',
  requirements: '수행 조건',
  visitGuide: '방문·예약 안내',
  visitHours: '방문 가능 시간',
  startDate: '신청 시작일',
  endDate: '신청 마감일',
  announceDate: '선정 발표일',
  submissionDeadline: '후기 마감일',
  thumbnailUrl: '대표 사진 주소',
  destinationUrl: '도착 URL',
  clientProfileId: '고객사',
  sendPaymentLink: '결제 링크 발송',
  imageIds: '사진 순서',

  // 지원·제출
  missionId: '미션',
  message: '지원 동기',
  mediaUrls: '첨부 파일 주소',
  snsPostUrl: '게시물 주소',
  reviewNote: '검수 메모',
  rejectionReason: '반려 사유',
  reason: '사유',

  // 결제
  paymentKey: '결제 키',
  orderId: '주문번호',
  amount: '결제 금액',

  // 키워드·리포트
  keyword: '키워드',
  mainKeyword: '메인 키워드',
  keywords: '키워드',
  main: '메인 키워드',
  subs: '서브 키워드',
  region: '지역',
  product: '상품명',
  extras: '추가 키워드',
  url: '주소',
  trackingCode: '추적 코드',
  expiresInDays: '공개 기간',
};

/** 'a.b.c' 경로에서 사람이 읽을 이름을 찾는다. 가장 뒤쪽 칸 이름을 쓴다 */
export function fieldLabel(path: PropertyKey[]): string | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const part = path[i];
    if (typeof part !== 'string') continue; // 배열 인덱스는 건너뛴다
    const label = FIELD_LABELS[part];
    if (label) return label;
  }
  return null;
}

/** 'n자', 'n개' — 무엇을 세는지에 따라 단위를 바꾼다 */
function unit(origin: string | undefined): string {
  switch (origin) {
    case 'string': return '자';
    case 'array':
    case 'set': return '개';
    default: return '';
  }
}

/**
 * 타입 이름이 드러나는 기본 문구를 사용자 문장으로 바꾼다.
 * 바꿀 것이 없으면 null (= zod 한국어 기본 문구를 그대로 쓴다).
 */
function friendlyMessage(issue: RawIssue): string | null {
  switch (issue.code) {
    case 'invalid_type':
      // 값이 아예 안 온 경우와 형이 다른 경우를 가른다
      return issue.input === undefined || issue.input === null
        ? '필수 항목이에요'
        : '입력 형식을 확인해 주세요';

    case 'too_small': {
      const n = Number(issue.minimum);
      if (issue.origin === 'string' && n === 1) return '필수 항목이에요';
      if (issue.origin === 'array' && n >= 1) return `${n}개 이상 골라 주세요`;
      const u = unit(issue.origin);
      return u ? `${n}${u} 이상으로 입력해 주세요` : `${n} 이상으로 입력해 주세요`;
    }

    case 'too_big': {
      const n = Number(issue.maximum);
      const u = unit(issue.origin);
      if (issue.origin === 'array') return `${n}개까지 고를 수 있어요`;
      return u ? `${n}${u} 이하로 입력해 주세요` : `${n} 이하로 입력해 주세요`;
    }

    case 'invalid_format':
      return '형식을 확인해 주세요';

    case 'invalid_value':
      return '고를 수 있는 값이 아니에요';

    case 'not_multiple_of':
      return '입력값을 확인해 주세요';

    case 'unrecognized_keys':
      return '보낼 수 없는 항목이 섞여 있어요';

    // custom·invalid_union 등 나머지는 스키마가 적어 둔 문구를 그대로 쓴다
    default:
      return null;
  }
}

/**
 * 사용자에게 보여 줄 한 줄.
 * 문구 만들기는 위 z.config가 이미 끝냈으므로 여기서는 그대로 쓴다.
 * - 스키마가 적어 둔 문장: "비밀번호는 6자 이상이어야 합니다"
 * - zod가 만든 일반 오류: "이메일: 형식을 확인해 주세요"
 */
export const userMessage = (issue: Issue): string => issue.message;
