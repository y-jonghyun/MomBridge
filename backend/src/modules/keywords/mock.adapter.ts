import { createHash } from 'crypto';
import { KeywordToolAdapter, RawRelKeyword } from './keyword-tool';

/**
 * 약관 확인 전 개발용 Mock. 같은 힌트에는 항상 같은 결과를 돌려준다.
 * 실제 응답처럼 "<10" 문자열과 한글 경쟁 정도를 섞어 파서 경로를 그대로 탄다.
 */
export class MockKeywordToolAdapter implements KeywordToolAdapter {
  readonly source = 'mock' as const;
  calls = 0;

  async fetchRelated(hints: string[]): Promise<RawRelKeyword[]> {
    this.calls++;
    const suffixes = ['', '추천', '맛집', '후기', '가격', '예약', '근처', '데이트', '가볼만한곳', '인기'];
    const comps = ['낮음', '중간', '높음'];
    const out: RawRelKeyword[] = [];
    const seen = new Set<string>();
    for (const hint of hints) {
      for (const suffix of suffixes) {
        const kw = `${hint}${suffix}`;
        if (seen.has(kw)) continue;
        seen.add(kw);
        const h = createHash('sha256').update(kw).digest();
        const pc = h[0] % 7 === 0 ? '< 10' : String(h.readUInt16BE(1) % 3000);
        const mobile = h[3] % 9 === 0 ? '< 10' : h.readUInt16BE(4) % 12000;
        out.push({ relKeyword: kw, monthlyPcQcCnt: pc, monthlyMobileQcCnt: mobile, compIdx: comps[h[6] % 3] });
      }
    }
    return out;
  }
}
