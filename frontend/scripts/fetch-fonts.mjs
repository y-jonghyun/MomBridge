/**
 * Google Fonts가 주는 글꼴 조각(woff2)을 저장소에 받아 두고 @font-face CSS를 만든다. 손으로 한 번 돌린다(빌드에서 돌지 않는다).
 *
 *   node scripts/fetch-fonts.mjs
 *
 * 왜: 빌드 때 next/font/google이 글꼴을 받아 오다 실패하면 배포가 막힌다(2026-11 Vercel 빌드에서 실제로 실패).
 * 어떻게: Google이 나눠 주는 조각을 그대로 받고, 조각마다 unicode-range를 그대로 적어 화면에 필요한 조각만 받게 한다.
 *        통째 파일은 쓰지 않는다 — 한글 글꼴은 굵기마다 수 MB라 첫 화면이 느려진다.
 *
 * 결과
 *   public/fonts/<글꼴>/*.woff2   조각 파일 (파일 이름은 Google의 것 그대로 — 내용이 바뀌면 이름도 바뀌어 오래 캐시해도 안전)
 *   public/fonts/<글꼴>/OFL.txt   라이선스 (SIL Open Font License 1.1)
 *   src/app/fonts.css             @font-face + --font-sans·--font-serif·--font-accent
 *
 * 굵기를 더하거나 빼면 FAMILIES를 고치고 다시 돌린 뒤, 안 쓰는 조각 파일이 남지 않았는지 확인한다(이 스크립트는 폴더를 비우고 다시 채운다).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// woff2와 unicode-range 조각을 받으려면 요즘 브라우저처럼 물어야 한다
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// 지금 쓰는 굵기만 (app/layout.tsx에서 next/font/google로 쓰던 것과 같다)
const FAMILIES = [
  { slug: 'noto-sans-kr', family: 'Noto Sans KR', query: 'Noto+Sans+KR:wght@400;500;700', license: 'notosanskr', cssVar: '--font-sans' },
  { slug: 'gowun-batang', family: 'Gowun Batang', query: 'Gowun+Batang:wght@400;700', license: 'gowunbatang', cssVar: '--font-serif' },
  { slug: 'cormorant-garamond', family: 'Cormorant Garamond', query: 'Cormorant+Garamond:ital,wght@1,500', license: 'cormorantgaramond', cssVar: '--font-accent' },
];

// 글꼴이 오기 전 잠깐 보이는 대체 글꼴의 크기 맞춤 — next/font가 만들던 값 그대로 (글꼴이 바뀌어도 줄 높이가 덜 흔들리게)
const FALLBACKS = {
  'Noto Sans KR': 'src:local("Arial");ascent-override:110.73%;descent-override:27.49%;line-gap-override:0.00%;size-adjust:104.76%',
  'Gowun Batang': 'src:local("Times New Roman");ascent-override:106.14%;descent-override:26.35%;line-gap-override:0.00%;size-adjust:109.29%',
  'Cormorant Garamond': 'src:local("Times New Roman");ascent-override:95.27%;descent-override:29.59%;line-gap-override:0.00%;size-adjust:96.98%',
};

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

let out = `/*
 * 저장소에 넣어 둔 글꼴 (scripts/fetch-fonts.mjs가 만든 파일 — 손으로 고치지 않는다).
 * Google Fonts의 조각을 그대로 쓰고, 조각마다 unicode-range를 적어 화면에 나오는 글자의 조각만 받는다.
 * 라이선스: SIL Open Font License 1.1 — public/fonts/<글꼴>/OFL.txt
 */
`;
let rootVars = '';
let total = { files: 0, bytes: 0, faces: 0 };

for (const f of FAMILIES) {
  const dir = join(ROOT, 'public', 'fonts', f.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const css = await get(`https://fonts.googleapis.com/css2?family=${f.query}&display=swap`);
  const blocks = css.match(/(\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]+\}/g) ?? [];
  const seen = new Map();
  out += `\n/* ── ${f.family} ── */\n`;
  for (const block of blocks) {
    const url = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
    if (!url) throw new Error(`woff2가 아닌 조각: ${block.slice(0, 80)}`);
    if (!block.includes('unicode-range')) throw new Error(`unicode-range가 없는 조각: ${url}`);
    const name = url.split('/').pop();
    if (!seen.has(url)) {
      const buf = await get(url, 'bin');
      writeFileSync(join(dir, name), buf);
      seen.set(url, buf.length);
      total.files++; total.bytes += buf.length;
    }
    out += block.replace(url, `/fonts/${f.slug}/${name}`).replace(/\n\s*/g, '\n  ').replace(/\n  \}$/, '\n}') + '\n';
    total.faces++;
  }
  out += `@font-face {\n  font-family: '${f.family} Fallback';\n  ${FALLBACKS[f.family].replace(/;/g, ';\n  ')};\n}\n`;
  rootVars += `  ${f.cssVar}: '${f.family}', '${f.family} Fallback';\n`;

  const license = await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${f.license}/OFL.txt`);
  writeFileSync(join(dir, 'OFL.txt'), license);
  console.log(`${f.family}: 조각 ${seen.size}개, @font-face ${blocks.length}개`);
}

out += `\n/* app/layout.tsx의 tailwind fontFamily(sans·serif·accent)가 이 변수를 쓴다 */\n:root {\n${rootVars}}\n`;
writeFileSync(join(ROOT, 'src', 'app', 'fonts.css'), out);
console.log(`합계: 파일 ${total.files}개 ${(total.bytes / 1024 / 1024).toFixed(1)}MB, @font-face ${total.faces}개`);
