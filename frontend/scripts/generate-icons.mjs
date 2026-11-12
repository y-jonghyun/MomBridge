/**
 * public/icons/ 의 원본 SVG 두 개로 앱 아이콘 세트를 만든다 (손으로 돌린다, 결과 PNG는 커밋한다).
 *
 *   node scripts/generate-icons.mjs
 *
 * 원본은 시안 D2 (design/icon-concepts 브랜치의 frontend/design/icon-concepts/variants/make-variants.mjs 출력 그대로).
 *   - icon-source.svg          : any·apple-touch·favicon용. 심볼이 캔버스의 68% (1.2배)
 *   - icon-source-maskable.svg : maskable용. 1.15배, 가장 먼 점이 중심에서 약 390 (안전 영역 원 409.6 안)
 * 두 원본 모두 clay 바탕이 캔버스를 꽉 채운다 — 투명 영역 없음, 모서리는 둥글리지 않는다 (OS가 자른다).
 *
 * sharp는 Next.js가 이미 함께 설치하는 이미지 라이브러리라 따로 의존성을 추가하지 않았다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
const anySvg = readFileSync(join(OUT, 'icon-source.svg'));
const maskableSvg = readFileSync(join(OUT, 'icon-source-maskable.svg'));
/** 디자인 토큰 clay — 원본의 바탕색과 같다 */
const CLAY = '#A9572F';

const png = (size, svg = anySvg) =>
  sharp(svg, { density: 72 * (size / 1024) * 4 })
    .resize(size, size)
    .flatten({ background: CLAY }) // 알파 채널 제거 — iOS는 투명 영역을 검게 채운다
    .png({ compressionLevel: 9 })
    .toBuffer();

const targets = {
  'icon-1024.png': [1024],
  'icon-512.png': [512],
  'icon-192.png': [192],
  'icon-maskable-512.png': [512, maskableSvg],
  'apple-touch-icon.png': [180],
  'favicon-32.png': [32],
};
for (const [name, [size, svg]] of Object.entries(targets)) {
  writeFileSync(join(OUT, name), await png(size, svg));
  console.log(`${name} (${size}px)`);
}

// favicon.ico: 16·32·48 PNG를 그대로 담은 ICO (Vista 이후 모든 브라우저가 PNG 내장 ICO를 읽는다)
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(s => png(s)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4); // color planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
writeFileSync(join(ROOT, 'public', 'favicon.ico'), Buffer.concat([header, ...images]));
console.log('public/favicon.ico (16·32·48)');
