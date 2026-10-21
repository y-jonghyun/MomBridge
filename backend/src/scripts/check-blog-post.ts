/**
 * 네이버 블로그 글 1건으로 리뷰 확인 로직을 점검한다 (아무것도 저장하지 않음, 글 1건 1회 조회).
 *
 * 로컬에서 조회 (내 PC의 IP로 네이버에 접속):
 *   npm run build
 *   npm run review:check-post -- <블로그 글 URL> [--code <추적코드>] [--keyword <메인키워드>] [--json] [--save-html post.html]
 *   (DATABASE_URL이 있으면 운영 설정의 대가 표시 문구를, 없으면 기본 문구를 쓴다)
 *
 * 배포 서버에서 조회 (Render 서버의 IP로 네이버에 접속 — 서버에서 차단되는지 확인):
 *   npm run review:check-post -- <블로그 글 URL> --server https://mombridge-backend.onrender.com [--email <운영자 이메일>]
 *   (운영자 비밀번호는 화면에 표시되지 않는 프롬프트로 입력. 환경변수 MOMBRIDGE_TOKEN이 있으면 그 토큰을 쓴다)
 */
import fs from 'fs';
import { ask, askHidden, parseArgs } from './cli';

const OFFLINE_DB = 'postgresql://offline:offline@127.0.0.1:1/offline';

// 서버 설정 모듈이 필수 환경변수를 요구하므로 점검 도구용 자리값을 넣는다 (서버를 띄우지 않음)
process.env.DATABASE_URL ||= OFFLINE_DB;
process.env.JWT_ACCESS_SECRET ||= 'cli-unused';
process.env.JWT_REFRESH_SECRET ||= 'cli-unused';
process.env.LOG_LEVEL ||= 'error';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args._[0];
  if (!url) {
    console.error('사용법: npm run review:check-post -- <블로그 글 URL> [--code X] [--keyword Y] [--json] [--save-html 파일] [--server <백엔드 주소> [--email E]]');
    process.exit(2);
  }
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined);
  const { formatDiagnose, diagnoseBlogPost } = await import('../modules/review-check/diagnose');

  let report;
  if (str('server')) {
    const server = str('server')!.replace(/\/+$/, '');
    let token = process.env.MOMBRIDGE_TOKEN;
    if (!token) {
      const email = str('email') ?? await ask('운영자 이메일: ');
      const password = await askHidden('비밀번호: ');
      const login = await fetch(`${server}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(90_000), // 무료 플랜 기동 대기
      });
      const body = await login.json().catch(() => ({})) as any;
      if (!login.ok) throw new Error(`로그인 실패 (HTTP ${login.status}) ${body?.error?.message ?? ''}`);
      if (body.data?.user?.role !== 'OPERATOR') throw new Error('운영자 계정이 아닙니다');
      token = body.data.accessToken as string;
    }
    const res = await fetch(`${server}/api/v1/operator/tools/check-blog-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, trackingCode: str('code'), mainKeyword: str('keyword') }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await res.json().catch(() => ({})) as any;
    if (!res.ok) throw new Error(`서버 점검 실패 (HTTP ${res.status}) ${body?.error?.message ?? ''}`);
    report = body.data;
    if (str('save-html')) console.error('참고: --save-html은 로컬 실행에서만 동작합니다');
  } else {
    const { settingDefaults, getSetting } = await import('../modules/settings/settings');
    const useDb = process.env.DATABASE_URL !== OFFLINE_DB;
    const phrases = useDb ? await getSetting('submission.disclosurePhrases') : settingDefaults['submission.disclosurePhrases'];
    const topChars = useDb ? await getSetting('submission.disclosureTopChars') : settingDefaults['submission.disclosureTopChars'];
    if (!args.json) console.log(`대가 표시 문구: ${useDb ? 'DB 운영 설정' : '기본값 (DATABASE_URL 없음)'}`);

    let savedHtml = '';
    const { NaverBlogPostFetcher } = await import('../modules/review-check/post-fetcher');
    const inner = new NaverBlogPostFetcher();
    report = await diagnoseBlogPost(url, { trackingCode: str('code') ?? null, mainKeyword: str('keyword') ?? null, disclosurePhrases: phrases, topChars }, 'local', {
      fetchPost: async ref => { const r = await inner.fetchPost(ref); savedHtml = r.html; return r; },
    });
    if (str('save-html') && savedHtml) {
      fs.writeFileSync(str('save-html')!, savedHtml, 'utf8');
      if (!args.json) console.log(`받은 HTML을 저장했습니다: ${str('save-html')}`);
    }
  }

  console.log(args.json ? JSON.stringify(report, null, 2) : formatDiagnose(report));
}

main()
  .catch(err => { console.error(`실패: ${(err as Error).message}`); process.exitCode = 1; })
  .finally(async () => {
    const { prisma } = await import('../config/database');
    await prisma.$disconnect().catch(() => undefined);
  });
