/**
 * 추적 링크 /r/:code — 플랫폼 도메인에서 받아 백엔드로 넘기고, 백엔드가 준 302를 그대로 돌려준다.
 * 백엔드(Render)가 잠들어 있어 응답이 늦으면 빈 화면 대신 "이동 중" 페이지를 보여주고 자동 재시도한다.
 * 실제 방문자 IP·UA는 서버 전용 공유 비밀값과 함께 넘긴다 (브라우저로는 절대 노출되지 않음).
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CODE = /^[0-9A-Za-z]{12}$/;
const ATTEMPT_TIMEOUT_MS = 9000;
const MAX_RETRIES = 6; // 1회 9초 + 재시도 → 최대 약 1분 대기 (무료 플랜 기동 시간)

function backendOrigin(): string {
  const explicit = process.env.TRACKING_BACKEND_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  return api.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function html(status: number, title: string, body: string, refreshTo?: string) {
  const refresh = refreshTo ? `<meta http-equiv="refresh" content="1;url=${refreshTo}">` : '';
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">${refresh}<title>${title}</title></head>` +
    `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#334155"><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function handle(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE.test(code)) return html(404, '링크를 찾을 수 없습니다', '주소를 다시 확인해 주세요.');

  const url = new URL(req.url);
  const retry = Math.min(Number(url.searchParams.get('w') ?? '0') || 0, MAX_RETRIES);
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  const headers: Record<string, string> = {
    'x-mb-proxy-secret': process.env.TRACKING_PROXY_SECRET ?? '',
    'x-mb-client-ip': req.headers.get('x-real-ip') ?? forwarded ?? '',
    'x-mb-user-agent': req.headers.get('user-agent') ?? '',
    'x-mb-referer': req.headers.get('referer') ?? '',
    'x-mb-retry': String(retry),
  };

  try {
    const res = await fetch(`${backendOrigin()}/r/${code}`, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      return new Response(null, { status: 302, headers: { ...noStore, Location: location } });
    }
    if (res.status === 404) return html(404, '링크를 찾을 수 없습니다', '만료됐거나 아직 준비되지 않은 링크입니다.');
    if (res.status === 429) return html(429, '요청이 너무 많습니다', '잠시 후 다시 시도해 주세요.');
    throw new Error(`backend ${res.status}`);
  } catch {
    if (retry < MAX_RETRIES) {
      return html(503, '페이지로 이동하고 있습니다', '잠시만 기다려 주세요. 자동으로 이동합니다.', `/r/${code}?w=${retry + 1}`);
    }
    return html(503, '잠시 후 다시 시도해 주세요', '일시적인 오류로 이동하지 못했습니다.');
  }
}

export const GET = handle;
export const HEAD = handle;
