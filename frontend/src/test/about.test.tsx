import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from '@/app/about/page';

/**
 * 엄마용 소개 페이지. 로그인 없이 그려지고, '한부모' 같은 말은 쓰지 않는다.
 */

describe('/about (엄마용 소개)', () => {
  it('핵심 제목과 버튼이 나온다', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toContain('아이 등원 후 두 시간');
    expect(screen.getByRole('heading', { name: '맘브릿지는 이런 곳이에요' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '이렇게 진행돼요' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: '우리 동네 미션 보기' }).length).toBeGreaterThan(0);
  });

  it('보상 예시는 수수료 상수를 따른다', () => {
    const { container } = render(<AboutPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('20,000원');
    expect(text).toContain('플랫폼 수수료 10%');
    expect(text).toContain('18,000원');
  });

  it('지급일은 정산 규칙과 같은 표현을 쓴다', () => {
    const { container } = render(<AboutPage />);
    expect(container.textContent).toContain('다음 달 10일');
  });

  it("'한부모'라는 말이 없다", () => {
    const { container } = render(<AboutPage />);
    expect(container.textContent).not.toContain('한부모');
  });
});
