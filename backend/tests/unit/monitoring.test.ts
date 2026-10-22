import type { ErrorEvent } from '@sentry/node';
import { areaForPath, monitoringEnabled, scrubBreadcrumb, scrubEvent, captureError } from '../../src/lib/monitoring';

describe('monitoring', () => {
  it('is off without SENTRY_DSN (tests, local) and capturing is then a no-op', () => {
    expect(monitoringEnabled).toBe(false);
    expect(() => captureError(new Error('x'), { area: 'payment' })).not.toThrow();
  });

  it('tags payment and payout routes so alerts can target them', () => {
    expect(areaForPath('/api/v1/missions/pay-and-create')).toBe('payment');
    expect(areaForPath('/api/v1/missions/3f2a9c1e-0000-4000-8000-000000000000/pay')).toBe('payment');
    expect(areaForPath('/api/v1/operator/payouts/abc')).toBe('payout');
    expect(areaForPath('/api/v1/participant/payouts')).toBe('payout');
    expect(areaForPath('/api/v1/missions/abc/status')).toBe('api');
    expect(areaForPath('/api/v1/missions')).toBe('api');
  });

  it('strips bodies, cookies, query strings, auth headers and user details before sending', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://api/x?email=mom@example.com', data: { password: 'p', paymentKey: 'k' }, cookies: { refreshToken: 't' }, query_string: 'token=abc',
        headers: { Authorization: 'Bearer abc', 'User-Agent': 'ua', 'X-Tracking-Proxy-Secret': 's', 'X-Forwarded-For': '1.2.3.4' },
      },
      user: { id: 'u1', email: 'mom@example.com', ip_address: '1.2.3.4' },
    } as ErrorEvent);
    expect(event.request).toEqual({ url: 'https://api/x', headers: { 'User-Agent': 'ua' } });
    expect(event.user).toEqual({ id: 'u1' });
  });

  it('drops console breadcrumbs and query strings in request breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'login mom@example.com' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'http', data: { url: 'https://api.tosspayments.com/v1/x?orderId=1', method: 'POST' } }))
      .toEqual({ category: 'http', data: { url: 'https://api.tosspayments.com/v1/x', method: 'POST' } });
  });
});
