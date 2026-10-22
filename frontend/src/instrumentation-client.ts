// 브라우저 오류 모니터링. NEXT_PUBLIC_SENTRY_DSN이 없으면 켜지지 않는다 (DSN은 공개돼도 되는 값)
// SDK는 DSN이 있을 때만 따로 불러온다 → 모니터링을 안 쓰는 동안 모든 페이지 첫 로딩 크기가 늘지 않게
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import('@sentry/nextjs').then(Sentry => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // 확장 프로그램·네트워크 끊김처럼 우리 코드와 무관한 오류는 버린다
      ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications', 'Network Error', 'Load failed'],
      beforeSend(event) {
        if (event.request?.url) event.request.url = event.request.url.split('?')[0];
        delete event.request?.cookies;
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
      // 콘솔 기록은 버리고, 주소의 쿼리(이메일·토큰이 들어갈 수 있음)는 지운다
      beforeBreadcrumb(crumb) {
        if (crumb.category === 'console') return null;
        for (const k of ['url', 'from', 'to']) {
          const v = crumb.data?.[k];
          if (typeof v === 'string') crumb.data![k] = v.split('?')[0];
        }
        return crumb;
      },
    });
  });
}

export {};
