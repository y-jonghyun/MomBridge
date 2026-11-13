import { afterEach, describe, expect, it } from 'vitest';
import { loadPostcode, POSTCODE_SCRIPT_URL, resetPostcodeLoader, toPickedAddress, type PostcodeResult } from '@/lib/kakao-postcode';
import { areaLabel } from '@/components/missions/MissionBrowser';

/** 우편번호 결과 → 가게 폼 네 칸 (시·도 / 시·군·구 / 동 / 주소) */

const base: PostcodeResult = {
  userSelectedType: 'R',
  roadAddress: '서울 마포구 양화로 45',
  jibunAddress: '서울 마포구 합정동 123-4',
  sido: '서울',
  sigungu: '마포구',
  bname: '합정동',
  bname1: '',
  buildingName: '',
  apartment: 'N',
};

describe('toPickedAddress', () => {
  it('도로명 주소와 정식 시·도 이름, 구, 동을 채운다', () => {
    expect(toPickedAddress(base)).toEqual({
      address: '서울 마포구 양화로 45', regionSi: '서울특별시', regionGu: '마포구', regionDong: '합정동',
    });
  });

  it('지번을 고르면 지번 주소', () => {
    expect(toPickedAddress({ ...base, userSelectedType: 'J' }).address).toBe('서울 마포구 합정동 123-4');
  });

  it('시가 붙은 구는 선택 상자 목록과 같은 "성남시 분당구"', () => {
    const p = toPickedAddress({ ...base, sido: '경기', sigungu: '성남시 분당구', bname: '정자동' });
    expect(p.regionSi).toBe('경기도');
    expect(p.regionGu).toBe('성남시 분당구');
  });

  it('읍·면 지역은 리 대신 읍·면 이름', () => {
    const p = toPickedAddress({ ...base, sido: '부산', sigungu: '기장군', bname: '대라리', bname1: '기장읍' });
    expect(p.regionDong).toBe('기장읍');
  });

  it('세종은 시·군·구가 비어 오면 "세종시"', () => {
    const p = toPickedAddress({ ...base, sido: '세종특별자치시', sigungu: '', bname: '보람동' });
    expect(p).toMatchObject({ regionSi: '세종특별자치시', regionGu: '세종시', regionDong: '보람동' });
  });

  it('공동주택이면 건물 이름을 괄호로 덧붙인다', () => {
    expect(toPickedAddress({ ...base, buildingName: '합정 래미안', apartment: 'Y' }).address)
      .toBe('서울 마포구 양화로 45 (합정 래미안)');
  });
});

describe('loadPostcode', () => {
  afterEach(() => {
    document.querySelectorAll(`script[src="${POSTCODE_SCRIPT_URL}"]`).forEach(s => s.remove());
    delete window.daum;
    delete window.kakao;
    resetPostcodeLoader();
  });

  it('닫히는 daumcdn이 아니라 kakaocdn에서 불러온다', () => {
    expect(POSTCODE_SCRIPT_URL).toMatch(/^https:\/\/t1\.kakaocdn\.net\//);
  });

  it('스크립트를 한 번만 넣고, 불러오면 생성자를 돌려준다', async () => {
    const p1 = loadPostcode();
    const p2 = loadPostcode();
    const scripts = document.querySelectorAll(`script[src="${POSTCODE_SCRIPT_URL}"]`);
    expect(scripts).toHaveLength(1);
    const Ctor = function () { return { embed: () => {} }; } as unknown as NonNullable<Window['daum']>['Postcode'];
    window.kakao = { Postcode: Ctor };
    scripts[0].dispatchEvent(new Event('load'));
    await expect(p1).resolves.toBe(Ctor);
    await expect(p2).resolves.toBe(Ctor);
  });

  it('못 불러오면 실패를 돌려주고 스크립트를 치운다 (다시 시도할 수 있게)', async () => {
    const p = loadPostcode();
    document.querySelector(`script[src="${POSTCODE_SCRIPT_URL}"]`)!.dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow();
    expect(document.querySelectorAll(`script[src="${POSTCODE_SCRIPT_URL}"]`)).toHaveLength(0);
  });
});

describe('카드의 동네 이름', () => {
  it('구 + 동, 동이 없으면 구만, 시가 붙은 구는 구 이름만', () => {
    expect(areaLabel('마포구', '합정동')).toBe('마포구 합정동');
    expect(areaLabel('마포구', null)).toBe('마포구');
    expect(areaLabel('성남시 분당구', '정자동')).toBe('분당구 정자동');
  });
});
