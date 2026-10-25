import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// Render 무료 플랜은 잠들었다 깨는 데 최대 50초쯤 걸린다 → 첫 요청이 시간 초과로 실패하지 않게 넉넉히
//
// Content-Type은 **기본값으로 두지 않는다.** 'application/json'을 깔아 두면 axios가
// FormData까지 JSON으로 바꿔 보내서 파일이 통째로 빠진다(사진 업로드가 400으로 실패했다).
// 평범한 객체는 axios가 알아서 application/json으로, FormData는 multipart로 보낸다.
const api = axios.create({
  baseURL,
  timeout: 70_000,
});

// ── 서버 기동 대기 안내 ──
// 요청이 몇 초 넘게 걸리면 화면에 "서버를 깨우는 중" 안내를 띄운다 (ServerWakeNotice가 구독)
const SLOW_MS = 4_000;
let pending = 0;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const slowListeners = new Set<(slow: boolean) => void>();
const emitSlow = (slow: boolean) => slowListeners.forEach(fn => fn(slow));

export function onSlowRequest(fn: (slow: boolean) => void): () => void {
  slowListeners.add(fn);
  return () => { slowListeners.delete(fn); };
}

function requestStarted() {
  pending++;
  if (!slowTimer) slowTimer = setTimeout(() => emitSlow(true), SLOW_MS);
}
function requestFinished() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = null;
    emitSlow(false);
  }
}

type RetryConfig = InternalAxiosRequestConfig & { _authRetried?: boolean; _wakeRetried?: boolean; _tracked?: boolean };

// 로그인·가입·재발급 요청의 401은 "비밀번호가 틀림" 같은 정상 응답이다 → 재발급·로그아웃 대상이 아니다
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];
const isAuthRequest = (url?: string) => !!url && AUTH_PATHS.some(p => url.startsWith(p));

api.interceptors.request.use((config: RetryConfig) => {
  // 혹시 어딘가에서 Content-Type을 json으로 지정해도 파일 전송은 지켜 준다
  // (경계 문자열이 들어간 multipart 헤더는 axios가 직접 만들어야 한다)
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const token = typeof window !== 'undefined' ? useAuthStore.getState().token : null;
  if (token && !isAuthRequest(config.url)) config.headers.Authorization = `Bearer ${token}`;
  if (typeof window !== 'undefined' && !config._tracked) { config._tracked = true; requestStarted(); }
  return config;
});

// 여러 요청이 동시에 401을 받아도 재발급은 한 번만
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    // 인터셉터를 거치지 않는 별도 요청 (무한 반복 방지)
    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 70_000 });
    useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken as string;
  } catch (err) {
    // 401 = 토큰 만료·무효화(비밀번호 변경, 계정 비활성화) → 로그아웃. 네트워크 오류는 로그인 상태 유지
    if ((err as AxiosError).response?.status === 401) return null;
    throw err;
  }
}

function logoutToLogin() {
  useAuthStore.getState().clearAuth();
  if (window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}&expired=1`;
  }
}

const isWakeError = (err: AxiosError) =>
  !err.response || [502, 503, 504].includes(err.response.status);

api.interceptors.response.use(
  (res) => { if ((res.config as RetryConfig)._tracked) requestFinished(); return res; },
  async (err: AxiosError) => {
    const config = err.config as RetryConfig | undefined;
    if (config?._tracked) requestFinished();
    if (!config || typeof window === 'undefined') return Promise.reject(err);

    // 서버가 깨어나는 중이면 조회(GET)만 한 번 다시 시도한다. 결제·제출 같은 POST는 중복될 수 있어 재시도하지 않음
    if (isWakeError(err) && (config.method ?? 'get').toLowerCase() === 'get' && !config._wakeRetried) {
      config._wakeRetried = true;
      config._tracked = false;
      await new Promise(r => setTimeout(r, 1_500));
      return api(config);
    }

    if (err.response?.status === 401 && !isAuthRequest(config.url) && !config._authRetried) {
      config._authRetried = true;
      if (!useAuthStore.getState().refreshToken) return Promise.reject(err);
      try {
        refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
        const token = await refreshing;
        if (!token) { logoutToLogin(); return Promise.reject(err); }
        config._tracked = false;
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

/** 화면에 보여줄 오류 문구. 서버 메시지가 없으면 상황별 안내 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ error?: { message?: string } }>;
  const msg = e?.response?.data?.error?.message;
  if (msg) return msg;
  if (e?.code === 'ECONNABORTED' || !e?.response) return '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요';
  return fallback;
}

export default api;
