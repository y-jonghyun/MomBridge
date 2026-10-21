import * as Sentry from '@sentry/nextjs';

// 서버 쪽(라우트 핸들러 /r/[code], 서버 렌더링) 오류. SENTRY_DSN이 없으면 켜지지 않는다
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
        if (event.request.url) event.request.url = event.request.url.split('?')[0];
      }
      return event;
    },
  });
}

export const onRequestError = Sentry.captureRequestError;
