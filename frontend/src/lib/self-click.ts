import api from '@/lib/api';

/**
 * 체험단원 본인 클릭 제외: 서버가 서명한 값을 /r 경로 전용 쿠키에 넣어 둔다.
 * 추적 링크(/r/:code) 요청에만 실려 가고, 링크 주인 본인이면 집계에서 빠진다.
 */
const COOKIE = 'mb_self';

export async function syncSelfClickCookie(): Promise<void> {
  try {
    const { data } = await api.get('/participant/self-click-token');
    const { token, maxAgeSec } = data.data as { token: string | null; maxAgeSec: number };
    if (!token) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/r; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
  } catch { /* 실패해도 집계에서 빠지지 않을 뿐 다른 기능에는 영향 없음 */ }
}
