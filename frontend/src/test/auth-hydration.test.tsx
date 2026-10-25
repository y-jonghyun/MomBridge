import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { useAuthHydrated, useAuthStore } from '@/store/auth';

/**
 * 새로고침하거나 주소를 직접 열면 /login으로 튕기던 문제.
 *
 * 저장해 둔 로그인 정보를 다 읽기 전의 첫 그림에서는 user가 null이다.
 * 그때 화면 가드가 판단해 버리면 토큰이 멀쩡한데도 로그인 화면으로 보낸다.
 * 가드는 useAuthHydrated()가 true가 된 뒤에만 판단한다.
 */

const push = vi.fn();

/** 여섯 화면(운영자·참여자·고객사·커뮤니티·글·미션 상세)이 쓰는 가드와 같은 모양 */
function Guarded() {
  const user = useAuthStore(s => s.user);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { push('/login'); return; }
  }, [user, hydrated]);

  if (!hydrated) return <p>불러오는 중</p>;
  if (!user) return null;
  return <p>{user.name}님 화면</p>;
}

const USER = { id: 'u1', email: 'a@b.com', name: '엄마', role: 'OPERATOR' as const };

/** 복원이 아직 끝나지 않은 상태를 만든다 */
function pending() {
  let finish: (() => void) | null = null;
  vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
  vi.spyOn(useAuthStore.persist, 'onFinishHydration').mockImplementation(cb => {
    finish = () => cb(useAuthStore.getState());
    return () => {};
  });
  return {
    /** 저장돼 있던 값을 넣고 복원이 끝났다고 알린다 */
    done(user: typeof USER | null) {
      act(() => {
        useAuthStore.setState({ user, token: user ? 't' : null, refreshToken: user ? 'r' : null });
        finish?.();
      });
    },
  };
}

beforeEach(() => {
  push.mockClear();
  useAuthStore.setState({ user: null, token: null, refreshToken: null });
});
afterEach(() => vi.restoreAllMocks());

describe('로그인 상태 복원', () => {
  it('복원 전에는 로그인 화면으로 보내지 않는다', () => {
    pending();
    render(<Guarded />);

    // 브라우저가 처음 칠하는 그림. 옛 가드는 여기서 /login으로 보냈다
    expect(screen.getByText('불러오는 중')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('복원이 끝나면 저장돼 있던 화면이 그대로 열린다', () => {
    const hydration = pending();
    render(<Guarded />);
    hydration.done(USER);

    expect(screen.getByText('엄마님 화면')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('복원했는데 로그인 정보가 없을 때만 /login으로 보낸다', () => {
    const hydration = pending();
    render(<Guarded />);
    expect(push).not.toHaveBeenCalled();

    hydration.done(null);

    expect(push).toHaveBeenCalledWith('/login');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('이미 복원이 끝난 뒤에 열어도 곧바로 판단한다', async () => {
    useAuthStore.setState({ user: USER, token: 't', refreshToken: 'r' });
    render(<Guarded />);

    await waitFor(() => expect(screen.getByText('엄마님 화면')).toBeTruthy());
    expect(push).not.toHaveBeenCalled();
  });
});
