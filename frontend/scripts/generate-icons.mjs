/**
 * public/icons/icon-source.svg 에서 앱 아이콘 세트를 만든다 (손으로 돌린다, 결과 PNG는 커밋한다).
 *
 *   node scripts/generate-icons.mjs
 *
 * sharp는 Next.js가 이미 함께 설치하는 이미지 라이브러리라 따로 의존성을 추가하지 않았다.
 * 원본 SVG는 배경이 꽉 찬 크림색이고 로고가 가운데 80% 안에 있어서,
 * 같은 원본으로 any / maskable / apple-touch(투명 배경 금지)를 모두 만들 수 있다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
const svg = readFileSync(join(OUT, 'icon-source.svg'));

const png = size =>
  sharp(svg, { density: 72 * (size / 1024) * 4 })
    .resize(size, size)
    .flatten({ background: '#F6F1E8' }) // 알파 채널 제거 — iOS는 투명 영역을 검게 채운다
    .png({ compressionLevel: 9 })
    .toBuffer();

const targets = {
  'icon-1024.png': 1024,
  'icon-512.png': 512,
  'icon-192.png': 192,
  'icon-maskable-512.png': 512,
  'apple-touch-icon.png': 180,
  'favicon-32.png': 32,
};
for (const [name, size] of Object.entries(targets)) {
  writeFileSync(join(OUT, name), await png(size));
  console.log(`${name} (${size}px)`);
}

// favicon.ico: 16·32·48 PNG를 그대로 담은 ICO (Vista 이후 모든 브라우저가 PNG 내장 ICO를 읽는다)
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
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
