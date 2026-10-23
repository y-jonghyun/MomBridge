/**
 * 여러 줄 입력(확인사항·방문 안내)을 줄 단위로 나눈다.
 *
 * 글자 그대로의 "\n"(역슬래시 + n)도 줄바꿈으로 본다.
 * 외부에서 옮겨 붙인 값이나 예전 데이터에 이 모양이 섞여 있는데,
 * 그대로 두면 화면에 "\n"이 글자로 보인다.
 */
export function toLines(text?: string | null): string[] {
  return String(text ?? '')
    .replace(/\r\n|\n/g, '\n')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}
