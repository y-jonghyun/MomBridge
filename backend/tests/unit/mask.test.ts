import { maskName } from '../../src/lib/mask';

/** 고객사 화면과 공유 리포트가 함께 쓰는 이름 가리기 */
describe('이름 가리기', () => {
  it('세 글자 한글은 가운데를 가린다', () => {
    expect(maskName('윤종현')).toBe('윤○현');
    expect(maskName('홍길동')).toBe('홍○동');
  });

  it('네 글자 이상도 처음과 끝만 남긴다', () => {
    expect(maskName('남궁민수')).toBe('남○○수');
  });

  it('두 글자는 뒤를 가린다', () => {
    expect(maskName('김철')).toBe('김○');
  });

  it('한 글자는 가릴 것이 없어 그대로 둔다', () => {
    expect(maskName('김')).toBe('김');
  });

  it('영문은 첫 글자만 남긴다', () => {
    expect(maskName('Sarah')).toBe('S○○○○');
    expect(maskName('Kim Jisoo')).toBe('K○○ ○○○○○');
  });

  it('비어 있으면 빈 문자열', () => {
    expect(maskName('')).toBe('');
    expect(maskName('   ')).toBe('');
    expect(maskName(null)).toBe('');
    expect(maskName(undefined)).toBe('');
  });
});
