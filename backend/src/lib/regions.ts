/**
 * 시·도 정식 명칭과 흔히 쓰는 다른 표기. 미션 지역(regionSi)은 정식 명칭으로 저장하고,
 * 필터는 예전에 다른 표기로 저장된 미션도 찾도록 별칭까지 함께 검색한다.
 * 프론트 src/lib/regions.ts와 같은 목록을 유지한다.
 */
export const PROVINCES: { name: string; short: string; aliases: string[] }[] = [
  { name: '서울특별시', short: '서울', aliases: ['서울', '서울시'] },
  { name: '부산광역시', short: '부산', aliases: ['부산', '부산시'] },
  { name: '대구광역시', short: '대구', aliases: ['대구', '대구시'] },
  { name: '인천광역시', short: '인천', aliases: ['인천', '인천시'] },
  { name: '광주광역시', short: '광주', aliases: ['광주', '광주시'] },
  { name: '대전광역시', short: '대전', aliases: ['대전', '대전시'] },
  { name: '울산광역시', short: '울산', aliases: ['울산', '울산시'] },
  { name: '세종특별자치시', short: '세종', aliases: ['세종', '세종시'] },
  { name: '경기도', short: '경기', aliases: ['경기'] },
  { name: '강원특별자치도', short: '강원', aliases: ['강원', '강원도'] },
  { name: '충청북도', short: '충북', aliases: ['충북'] },
  { name: '충청남도', short: '충남', aliases: ['충남'] },
  { name: '전북특별자치도', short: '전북', aliases: ['전북', '전북도', '전라북도'] },
  { name: '전라남도', short: '전남', aliases: ['전남'] },
  { name: '경상북도', short: '경북', aliases: ['경북'] },
  { name: '경상남도', short: '경남', aliases: ['경남'] },
  { name: '제주특별자치도', short: '제주', aliases: ['제주', '제주도'] },
];

const byAnyName = new Map<string, string>();
for (const p of PROVINCES) for (const n of [p.name, ...p.aliases]) byAnyName.set(n.replace(/\s+/g, ''), p.name);

/** '충북', '서울시' 같은 표기를 정식 명칭으로. 시·도가 아니면 null (예: '청주시') */
export function normalizeProvince(value: string): string | null {
  return byAnyName.get(value.replace(/\s+/g, '')) ?? null;
}

/** 필터용: 정식 명칭과 별칭 전부 */
export function provinceVariants(name: string): string[] {
  const p = PROVINCES.find(x => x.name === name);
  return p ? [p.name, ...p.aliases] : [name];
}
