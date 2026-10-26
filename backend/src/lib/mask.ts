/**
 * 화면에 이름을 가려서 보여 줄 때 쓰는 규칙. 고객사 응답과 공유 리포트가 같은 함수를 쓴다.
 *
 * - 세 글자 이상 한글: 가운데를 가린다 (윤종현 → 윤○현)
 * - 두 글자 한글: 뒤를 가린다 (김철 → 김○)
 * - 한 글자: 가릴 것이 없어 그대로 둔다
 * - 영문 등: 첫 글자만 남기고 나머지를 가린다 (Sarah → S○○○○)
 *
 * 운영자 경로에는 쓰지 않는다 — 운영자는 실명을 그대로 본다.
 */
const HIDDEN = '○';
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

export function maskName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';

  const chars = [...trimmed];
  if (chars.length === 1) return trimmed;

  // 공백은 그대로 두고 글자만 가린다 (이름 모양이 남아야 누구인지 구분할 수 있다)
  const hide = (i: number) => (/\s/.test(chars[i]) ? chars[i] : HIDDEN);

  if (!HANGUL.test(trimmed)) {
    return chars.map((c, i) => (i === 0 ? c : hide(i))).join('');
  }
  if (chars.length === 2) return `${chars[0]}${HIDDEN}`;
  return chars.map((c, i) => (i === 0 || i === chars.length - 1 ? c : hide(i))).join('');
}
