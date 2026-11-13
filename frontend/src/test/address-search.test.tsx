import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PostcodeResult } from '@/lib/kakao-postcode';

/**
 * 가게 정보 폼의 주소 검색 — 고르면 네 칸이 채워지고, 스크립트가 안 뜨면 지금처럼 직접 입력한다.
 * 우편번호 스크립트는 실제로 불러오지 않고 loadPostcode를 바꿔 끼운다.
 */

const postcode = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'fail',
  result: null as PostcodeResult | null,
  load: 0,
}));

vi.mock('@/lib/kakao-postcode', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/kakao-postcode')>();
  return {
    ...real,
    loadPostcode: () => {
      postcode.load++;
      if (postcode.mode === 'fail') return Promise.reject(new Error('blocked'));
      // embed가 불리면 곧바로 사용자가 주소 하나를 고른 것처럼 한다
      const Ctor = function (opts: { oncomplete: (d: PostcodeResult) => void }) {
        return { embed: () => { if (postcode.result) setTimeout(() => opts.oncomplete(postcode.result!), 0); } };
      };
      return Promise.resolve(Ctor);
    },
  };
});

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async () => ({
      data: { data: {
        businessName: '한결 베이커리', businessCategory: 'CAFE', address: '', regionSi: '', regionGu: '', regionDong: null,
        businessNumber: null, complete: false, missing: [],
      } },
    })),
    put: vi.fn(async () => ({ data: { data: {} } })),
  },
}));

import ClientStoreForm from '@/components/profile/ClientStoreForm';
import ShopFormModal from '@/components/operator/ShopFormModal';

const picked: PostcodeResult = {
  userSelectedType: 'R', roadAddress: '서울 마포구 양화로 45', jibunAddress: '서울 마포구 합정동 123-4',
  sido: '서울', sigungu: '마포구', bname: '합정동', bname1: '', buildingName: '', apartment: 'N',
};

// 전체 테스트를 함께 돌리면 jsdom이 느려 기본 1초 안에 폼이 안 뜰 때가 있다
const SLOW = { timeout: 5000 };

beforeEach(() => { postcode.mode = 'ok'; postcode.result = picked; postcode.load = 0; });
afterEach(() => { document.body.style.overflow = ''; });

describe('사장님 가게 정보 — 주소 검색', () => {
  it('고르면 시·도 · 시·군·구 · 동 · 사업장 주소가 채워지고 검색 창이 닫힌다', async () => {
    render(<ClientStoreForm />);
    const btn = await screen.findByRole('button', { name: '주소 검색으로 채우기' }, SLOW);
    fireEvent.click(btn);
    expect(screen.getByRole('dialog', { name: '주소 검색' })).toBeTruthy();

    await waitFor(() => expect((screen.getByLabelText('사업장 주소 *') as HTMLInputElement).value).toBe('서울 마포구 양화로 45'));
    expect((screen.getByLabelText('시·군·구 *') as HTMLSelectElement).value).toBe('마포구');
    expect((screen.getByLabelText('동 (선택)') as HTMLInputElement).value).toBe('합정동');
    expect(screen.queryByRole('dialog')).toBeNull();
    // 층·호수를 이어 쓰게 주소 칸으로 커서가 간다
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('사업장 주소 *')));
  });

  it('스크립트를 못 불러오면 안내만 보여 주고, 칸은 그대로 직접 입력할 수 있다', async () => {
    postcode.mode = 'fail';
    render(<ClientStoreForm />);
    expect(await screen.findByText(/주소 검색을 불러오지 못했어요/, undefined, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '주소 검색으로 채우기' })).toBeNull();

    const addr = screen.getByLabelText('사업장 주소 *') as HTMLInputElement;
    fireEvent.change(addr, { target: { value: '서울시 마포구 합정동 123 1층' } });
    expect(addr.value).toBe('서울시 마포구 합정동 123 1층');
    const dong = screen.getByLabelText('동 (선택)') as HTMLInputElement;
    fireEvent.change(dong, { target: { value: '합정동' } });
    expect(dong.value).toBe('합정동');

    // 다시 시도
    postcode.mode = 'ok';
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: '주소 검색으로 채우기' }, SLOW)).toBeTruthy();
  });
});

describe('운영자 가게 등록 — 주소 검색', () => {
  it('목록에 있는 "성남시 분당구"를 고르면 선택 상자에서 그대로 골라진다', async () => {
    postcode.result = { ...picked, sido: '경기', sigungu: '성남시 분당구', bname: '정자동', roadAddress: '경기 성남시 분당구 정자일로 1' };
    render(<ShopFormModal onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: '주소 검색으로 채우기' }, SLOW));
    await waitFor(() => expect((screen.getByLabelText('주소 (선택)') as HTMLInputElement).value).toBe('경기 성남시 분당구 정자일로 1'));
    expect((screen.getByLabelText('시·군·구 *') as HTMLSelectElement).value).toBe('성남시 분당구');
    expect((screen.getByLabelText('동 (선택)') as HTMLInputElement).value).toBe('정자동');
  });
});
