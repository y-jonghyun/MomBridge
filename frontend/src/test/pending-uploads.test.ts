import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 대행 등록에서 사진이 실패해도 성공처럼 끝나던 문제.
 * 한 장이 실패해도 나머지는 계속 올리고, 몇 장이 빠졌는지 돌려줘야 한다.
 */

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { post } }));

import { pendingUploadNotice, uploadPendingImages } from '@/components/missions/MissionImageUploader';

const item = (name: string) => ({
  key: name,
  file: new File(['x'], `${name}.jpg`, { type: 'image/jpeg' }),
  previewUrl: `blob:${name}`,
});

beforeEach(() => {
  post.mockReset();
  // jsdom에는 없는 함수라 채워 둔다
  URL.revokeObjectURL = vi.fn();
});

describe('등록 화면에서 고른 사진 올리기', () => {
  it('다 올라가면 실패가 0이다', async () => {
    post.mockResolvedValue({ data: {} });

    const result = await uploadPendingImages('m1', [item('a'), item('b')]);

    expect(result).toEqual({ uploaded: 2, failed: 0 });
    expect(post).toHaveBeenCalledTimes(2);
    expect(pendingUploadNotice(result.failed, '미션 관리 > 사진')).toBe('');
  });

  it('한 장이 실패해도 나머지는 계속 올리고 실패 수를 돌려준다', async () => {
    post
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('boom'));

    const result = await uploadPendingImages('m1', [item('a'), item('b'), item('c')]);

    expect(result).toEqual({ uploaded: 1, failed: 2 });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('실패하면 무엇을 해야 하는지 알려 준다', () => {
    expect(pendingUploadNotice(2, '미션 관리 > 사진'))
      .toBe('미션은 등록됐지만 사진 2장을 올리지 못했어요. 미션 관리 > 사진에서 다시 올려 주세요.');
  });
});
