// 시·도 정식 명칭(저장값)과 짧은 표시명. 백엔드 src/lib/regions.ts와 같은 목록
export const PROVINCES = [
  { name: '서울특별시', short: '서울', metro: true },
  { name: '부산광역시', short: '부산', metro: true },
  { name: '대구광역시', short: '대구', metro: true },
  { name: '인천광역시', short: '인천', metro: true },
  { name: '광주광역시', short: '광주', metro: true },
  { name: '대전광역시', short: '대전', metro: true },
  { name: '울산광역시', short: '울산', metro: true },
  { name: '세종특별자치시', short: '세종', metro: true },
  { name: '경기도', short: '경기', metro: false },
  { name: '강원특별자치도', short: '강원', metro: false },
  { name: '충청북도', short: '충북', metro: false },
  { name: '충청남도', short: '충남', metro: false },
  { name: '전북특별자치도', short: '전북', metro: false },
  { name: '전라남도', short: '전남', metro: false },
  { name: '경상북도', short: '경북', metro: false },
  { name: '경상남도', short: '경남', metro: false },
  { name: '제주특별자치도', short: '제주', metro: false },
] as const;

/**
 * '서울', '충북' 같은 예전 표기를 정식 명칭으로 바꾼다.
 * 예전에 저장된 값을 선택 상자에 그대로 넣으면 아무것도 안 고른 것처럼 보여서,
 * 화면에 채울 때 한 번 거친다. (서버도 저장할 때 같은 규칙으로 맞춘다)
 */
export function normalizeProvince(value: string): string {
  const cleaned = value.replace(/\s+/g, '');
  if (!cleaned) return '';
  const hit = PROVINCES.find(p => p.name === cleaned || p.short === cleaned || `${p.short}시` === cleaned);
  return hit?.name ?? value;
}
