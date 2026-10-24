import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ForShopsPage from '@/app/for-shops/page';

/**
 * 사장님용 소개 페이지. 금액은 적지 않고(가게마다 구성이 달라 문의로 안내한다),
 * 리포트 숫자는 '예시' 배지를 단 더미다.
 */

describe('/for-shops (사장님용 소개)', () => {
  it('핵심 제목과 리포트 예시 배지가 나온다', () => {
    render(<ForShopsPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toContain('동네 엄마들의 진짜 후기');
    expect(screen.getByRole('heading', { name: '미션이 끝나면 이렇게 받아 보세요' })).toBeTruthy();
    expect(screen.getByText('예시')).toBeTruthy();
  });

  it('문의 버튼은 제목이 채워진 메일을 연다', () => {
    render(<ForShopsPage />);
    const [inquiry] = screen.getAllByRole('link', { name: '미션 등록 문의' });
    expect(inquiry.getAttribute('href')).toContain('mailto:');
    expect(inquiry.getAttribute('href')).toContain(encodeURIComponent('[미션 등록 문의]'));
  });

  it('금액을 적지 않는다', () => {
    const { container } = render(<ForShopsPage />);
    const text = container.textContent ?? '';
    // '모집 인원' 같은 말은 걸리지 않게 숫자 + 원 형태만 본다
    expect(text).not.toMatch(/[0-9][0-9,]*\s*원/);
    expect(text).toContain('가게 상황에 맞춰');
  });

  it('한부모 문구는 이 페이지에만 둔다', () => {
    const { container } = render(<ForShopsPage />);
    expect(container.textContent).toContain('한부모');
  });
});
