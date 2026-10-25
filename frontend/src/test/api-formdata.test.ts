import { describe, expect, it, vi } from 'vitest';

/**
 * 사진 업로드가 전부 실패하던 원인.
 *
 * axios 인스턴스에 'Content-Type: application/json'을 깔아 두면 axios가 FormData까지
 * JSON으로 바꿔 보내서 파일이 통째로 빠진다(서버는 "사진 파일이 없습니다" 400).
 * 그래서 기본 헤더를 두지 않고, FormData일 때는 지정돼 있어도 지운다.
 */

vi.mock('@/store/auth', () => ({
  useAuthStore: { getState: () => ({ token: null, refreshToken: null }) },
}));

// vi.mock은 위로 끌어올려지므로 평범하게 들여와도 위의 가짜가 먼저 걸린다
import api from '@/lib/api';

/** 어댑터를 가로채 실제로 나가는 요청을 들여다본다 */
async function send(data: unknown, headers?: Record<string, string>) {
  const seen: { data?: unknown; contentType?: unknown } = {};
  await api.post('/missions/m1/images', data, {
    headers,
    adapter: async config => {
      seen.data = config.data;
      seen.contentType = config.headers?.['Content-Type'] ?? config.headers?.['content-type'];
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  return seen;
}

describe('api 요청 본문', () => {
  it('FormData는 그대로 나가고 Content-Type을 json으로 덮어쓰지 않는다', async () => {
    const body = new FormData();
    body.append('image', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    const sent = await send(body);

    expect(sent.data).toBeInstanceOf(FormData);
    expect(String(sent.contentType ?? '')).not.toContain('application/json');
  });

  it('FormData에 json 헤더가 지정돼 있어도 지운다', async () => {
    const body = new FormData();
    body.append('image', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    const sent = await send(body, { 'Content-Type': 'application/json' });

    expect(sent.data).toBeInstanceOf(FormData);
    expect(String(sent.contentType ?? '')).not.toContain('application/json');
  });

  it('평범한 객체는 지금처럼 json으로 나간다', async () => {
    const sent = await send({ title: '미션' });

    expect(typeof sent.data).toBe('string');
    expect(JSON.parse(sent.data as string)).toEqual({ title: '미션' });
    expect(String(sent.contentType)).toContain('application/json');
  });
});
