import readline from 'readline';

/** --key value 형태의 인자 파싱 (위치 인자는 _에) */
export function parseArgs(argv: string[]): { _: string[]; [key: string]: string | string[] | true } {
  const out: { _: string[]; [key: string]: string | string[] | true } = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else {
      out._.push(a);
    }
  }
  return out;
}

export function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

// 파이프 입력(자동화)은 줄 단위로 한 번만 읽어 여러 프롬프트가 나눠 쓴다
let pipedLines: string[] | null = null;
let pipedWaiters: ((line: string) => void)[] = [];
let pipedClosed = false;

function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    pipedLines = [];
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', line => { const w = pipedWaiters.shift(); if (w) w(line); else pipedLines!.push(line); });
    rl.on('close', () => { pipedClosed = true; pipedWaiters.forEach(w => w('')); pipedWaiters = []; });
  }
  if (pipedLines.length) return Promise.resolve(pipedLines.shift()!);
  if (pipedClosed) return Promise.resolve('');
  return new Promise(resolve => pipedWaiters.push(resolve));
}

/** 입력 내용을 화면에 표시하지 않는 프롬프트 (비밀번호용). 셸 기록에 남지 않도록 인자로 받지 않는다 */
export function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) { nextPipedLine().then(resolve); return; }
    process.stdout.write(question);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') { stdin.setRawMode(false); reject(new Error('cancelled')); return; }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}
