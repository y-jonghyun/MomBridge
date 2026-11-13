import { normalizeProvince } from './regions';

/**
 * 카카오(다음) 우편번호 서비스 — 가게 주소를 검색해 시·도 / 시·군·구 / 동을 자동으로 채운다.
 *
 * - 스크립트는 주소 입력 화면(가게 정보 폼)이 열릴 때만 불러온다. 다른 화면에는 넣지 않는다.
 * - 못 불러오면(차단·오프라인·시간 초과) 오류를 돌려주고, 화면은 지금처럼 직접 입력으로 둔다.
 * - API 키가 필요 없는 공개 서비스다.
 */

// t1.daumcdn.net은 2026-11-30에 닫힌다는 공지에 따라 kakaocdn 주소를 쓴다
export const POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const LOAD_TIMEOUT_MS = 8000;

/** 우편번호 서비스가 넘겨주는 값 중 우리가 쓰는 것 */
export interface PostcodeResult {
  /** 'R' 도로명 / 'J' 지번 — 사용자가 고른 쪽 */
  userSelectedType?: 'R' | 'J';
  roadAddress: string;
  jibunAddress: string;
  autoJibunAddress?: string;
  /** "서울", "경기", "세종특별자치시", "강원특별자치도" … */
  sido: string;
  /** "마포구", "성남시 분당구" (세종은 빈 값) */
  sigungu: string;
  /** 법정동·법정리 이름 ("합정동", "XX리") */
  bname: string;
  /** 읍·면 이름 (동 지역이면 빈 값) */
  bname1?: string;
  buildingName?: string;
  apartment?: 'Y' | 'N';
}

export interface PickedAddress {
  address: string;
  regionSi: string;
  regionGu: string;
  regionDong: string;
}

/** 우편번호 결과를 우리 폼의 네 칸으로 바꾼다 */
export function toPickedAddress(r: PostcodeResult): PickedAddress {
  const regionSi = normalizeProvince(r.sido ?? '');
  const sejong = regionSi === '세종특별자치시';
  const regionGu = (r.sigungu ?? '').trim() || (sejong ? '세종시' : '');
  // 읍·면 지역은 '리'보다 읍·면 이름이 동네를 더 잘 나타낸다
  const regionDong = (r.bname1 ?? '').trim() || (r.bname ?? '').trim();

  const base = r.userSelectedType === 'J'
    ? (r.jibunAddress || r.autoJibunAddress || r.roadAddress)
    : (r.roadAddress || r.jibunAddress);
  // 공동주택·건물 이름이 있으면 괄호로 덧붙인다 (우편번호 서비스가 권하는 표기)
  const extra = r.userSelectedType !== 'J' && r.buildingName && r.apartment === 'Y' ? ` (${r.buildingName})` : '';
  return { address: `${base}${extra}`, regionSi, regionGu, regionDong };
}

interface PostcodeInstance { embed: (el: HTMLElement, opts?: { autoClose?: boolean }) => void }
export type PostcodeCtor = new (opts: {
  oncomplete: (data: PostcodeResult) => void;
  width?: string | number;
  height?: string | number;
  theme?: Record<string, string>;
}) => PostcodeInstance;

declare global {
  // 새 스크립트는 window.kakao에 올리고 window.daum을 같은 것으로 둔다
  interface Window { daum?: { Postcode?: PostcodeCtor }; kakao?: { Postcode?: PostcodeCtor } }
}

let loading: Promise<PostcodeCtor> | null = null;
const found = () => window.kakao?.Postcode ?? window.daum?.Postcode;

/** 스크립트를 한 번만 넣는다. 실패하면 다음 호출 때 다시 시도할 수 있게 비운다. */
export function loadPostcode(): Promise<PostcodeCtor> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const ready = found();
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;

  loading = new Promise<PostcodeCtor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = POSTCODE_SCRIPT_URL;
    script.async = true;
    const timer = window.setTimeout(() => fail(new Error('timeout')), LOAD_TIMEOUT_MS);
    function fail(err: Error) {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(err);
    }
    script.onload = () => {
      window.clearTimeout(timer);
      const ctor = found();
      if (ctor) resolve(ctor);
      else fail(new Error('postcode missing'));
    };
    script.onerror = () => fail(new Error('load failed'));
    document.head.appendChild(script);
  });
  return loading;
}

/** 테스트용 — 불러오기 상태를 비운다 */
export function resetPostcodeLoader() { loading = null; }
