import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * 렌더 테스트 공통 준비.
 * next/link와 next/navigation은 앱 라우터가 있어야 돌아가므로 여기서 한 번만 바꿔 끼운다.
 */

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

afterEach(() => cleanup());
