import * as Sentry from '@sentry/node';

/**
 * 오류 모니터링 (Sentry). SENTRY_DSN이 없으면 아무것도 보내지 않는다(로컬·테스트 기본값).
 * 개인정보: 요청 본문·쿠키·인증 헤더·IP는 보내지 않는다.
 */
const dsn = process.env.SENTRY_DSN ?? '';
export const monitoringEnabled = !!dsn && process.env.NODE_ENV !== 'test';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-tracking-proxy-secret', 'x-internal-token', 'x-forwarded-for', 'x-real-ip'];

/** 보내기 전에 본문·쿠키·쿼리·민감 헤더를 지우고 사용자는 id만 남긴다 */
export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split('?')[0];
    for (const h of Object.keys(event.request.headers ?? {})) {
      if (SENSITIVE_HEADERS.includes(h.toLowerCase())) delete event.request.headers![h];
    }
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}

export function scrubBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (crumb.category === 'console') return null;
  for (const k of ['url', 'from', 'to']) {
    const v = crumb.data?.[k];
    if (typeof v === 'string') crumb.data![k] = v.split('?')[0];
  }
  return crumb;
}

export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.RENDER_GIT_COMMIT,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: event => scrubEvent(event),
    // 콘솔 로그 기록은 보내지 않고, 요청 주소의 쿼리는 지운다 (로그·쿼리에 남긴 값이 그대로 실려 갈 수 있음)
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/** 결제·정산처럼 알림을 따로 받아야 하는 영역. Sentry 알림 규칙에서 area 태그로 거른다 */
export type MonitoredArea = 'payment' | 'payout' | 'api';

export function areaForPath(path: string): MonitoredArea {
  if (/\/payouts?\b/.test(path)) return 'payout';
  if (/\/missions\/(pay-and-create|[^/]+\/pay)\b/.test(path)) return 'payment';
  return 'api';
}

export function captureError(err: unknown, ctx: { area: MonitoredArea; path?: string; userId?: string; extra?: Record<string, unknown> }): void {
  if (!monitoringEnabled) return;
  Sentry.withScope(scope => {
    scope.setTag('area', ctx.area);
    if (ctx.path) scope.setTag('route', ctx.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id'));
    if (ctx.userId) scope.setUser({ id: ctx.userId });
    if (ctx.extra) scope.setExtras(ctx.extra);
    if (ctx.area !== 'api') scope.setLevel('fatal');
    Sentry.captureException(err);
  });
}

/** 예외는 아니지만 알아야 하는 결제·정산 사건 (예: 토스 승인 거절) */
export function reportIssue(message: string, ctx: { area: MonitoredArea; level?: 'warning' | 'error'; extra?: Record<string, unknown> }): void {
  if (!monitoringEnabled) return;
  Sentry.withScope(scope => {
    scope.setTag('area', ctx.area);
    scope.setLevel(ctx.level ?? 'warning');
    if (ctx.extra) scope.setExtras(ctx.extra);
    Sentry.captureMessage(message);
  });
}

export function flushMonitoring(timeoutMs = 2000): Promise<boolean> {
  return monitoringEnabled ? Sentry.flush(timeoutMs) : Promise.resolve(true);
}
