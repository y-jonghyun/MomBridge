import { describe, expect, it } from 'vitest';
import { clientOptionLabel, sortClientOptions, type ClientOption } from '@/components/operator/RegisterMissionForm';

/**
 * 대행 등록의 고객사 목록.
 * 가게 이름이 비어 있으면 누구인지 알 수 없는 줄("(이메일) · 연락처 없음")이 됐다.
 */

const client = (over: Partial<ClientOption>): ClientOption => ({
  id: 'c1', businessName: '', user: { email: 'a@b.com' }, ...over,
});

describe('고객사 목록', () => {
  it('가게 이름이 없으면 그 사실을 먼저 적는다', () => {
    expect(clientOptionLabel(client({ businessName: '' })))
      .toBe('가게 이름 미등록 · a@b.com');
    expect(clientOptionLabel(client({ businessName: '   ' })))
      .toBe('가게 이름 미등록 · a@b.com');
  });

  it('가게 이름이 있으면 지금처럼 보여 준다', () => {
    expect(clientOptionLabel(client({ businessName: '마포 카페', contactPhone: '010-1111-2222' })))
      .toBe('마포 카페 (a@b.com) · 010-1111-2222');
    expect(clientOptionLabel(client({ businessName: '마포 카페' })))
      .toBe('마포 카페 (a@b.com) · 연락처 없음');
  });

  it('이름 없는 계정은 맨 아래로 보낸다', () => {
    const sorted = sortClientOptions([
      client({ id: '1', businessName: '' }),
      client({ id: '2', businessName: '하늘 베이커리' }),
      client({ id: '3', businessName: '' }),
      client({ id: '4', businessName: '가람 카페' }),
    ]);

    expect(sorted.map(c => c.id)).toEqual(['4', '2', '1', '3']);
  });

  it('원래 목록을 바꾸지 않는다', () => {
    const list = [client({ id: '1', businessName: '' }), client({ id: '2', businessName: '가게' })];
    sortClientOptions(list);
    expect(list.map(c => c.id)).toEqual(['1', '2']);
  });
});
