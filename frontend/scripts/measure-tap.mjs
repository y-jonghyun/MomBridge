/**
 * 진짜 브라우저에서 터치 영역을 재는 도구 (손으로 돌린다).
 *
 * jsdom은 화면을 그리지 않아 높이를 잴 수 없다 — 그래서 테스트(src/test/touch-targets.test.tsx)는
 * 클래스에 적힌 크기로만 본다. 이 스크립트는 실제 픽셀을 재서 그 검사를 뒷받침한다.
 *
 *   1) npm run dev 로 앱을 띄운다
 *   2) npm run measure:tap            (기본 390px)
 *      npm run measure:tap -- 390,768 /missions,/about
 *
 * CI에는 넣지 않는다 — 앱과 크롬을 함께 띄워야 해서 느리고, 환경을 많이 탄다.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.MEASURE_BASE_URL ?? 'http://localhost:3000';
const PORT = 9390;
const MIN = 44;

const widths = (process.argv[2] ?? '390').split(',').map(Number);
const paths = (process.argv[3] ?? '/,/missions,/login,/about,/for-shops').split(',');

const profile = mkdtempSync(join(tmpdir(), 'mb-measure-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=390,900', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 아직 안 떴다 */ }
    await sleep(500);
  }
  throw new Error('크롬이 뜨지 않았습니다. CHROME_PATH를 확인해 주세요');
}

const ws = new WebSocket(await debuggerUrl());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0;
const waiting = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
});
const send = (method, params = {}) => {
  const n = ++id;
  return new Promise((res, rej) => {
    waiting.set(n, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
};
const value = async expression =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');

let bad = 0;
for (const width of widths) {
  for (const path of paths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await send('Page.navigate', { url: BASE + path });
    for (let i = 0; i < 80; i++) { await sleep(300); if ((await value('document.readyState')) === 'complete') break; }
    await sleep(2000);

    const small = await value(`(() => {
      const min = ${MIN};
      // 라벨로 감싼 칸은 라벨을 눌러도 열린다 — 라벨이 충분히 크면 통과로 본다
      const tapHeight = e => {
        const own = e.getBoundingClientRect().height;
        const label = e.closest('label');
        return label ? Math.max(own, label.getBoundingClientRect().height) : own;
      };
      return [...document.querySelectorAll('a,button,summary,select,[role="menuitem"]')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && tapHeight(e) < min; })
        .map(e => (e.textContent.trim().slice(0, 18) || e.getAttribute('aria-label') || e.tagName) + ':' + Math.round(tapHeight(e)));
    })()`);

    if (small.length === 0) {
      console.log(`${width}px ${path} — 모두 ${MIN}px 이상`);
    } else {
      bad += small.length;
      console.log(`${width}px ${path} — ${MIN}px 미만 ${small.length}개: ${small.join(' | ')}`);
    }
  }
}

ws.close();
chrome.kill();
// 크롬이 아직 파일을 쥐고 있을 수 있다 — 임시 폴더는 지워지지 않아도 그냥 둔다
try { rmSync(profile, { recursive: true, force: true }); } catch { /* 임시 폴더는 OS가 치운다 */ }
console.log(bad === 0 ? '\n모두 통과' : `\n${bad}개가 ${MIN}px보다 작습니다`);
process.exit(bad === 0 ? 0 : 1);
