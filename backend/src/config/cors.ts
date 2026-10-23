import { env } from './env';

/**
 * Vercel 미리보기 주소. 배포마다 가운데 부분이 바뀌므로 패턴으로 허용한다.
 *   https://mombridge-frontend-<배포 식별자>-yjh900424-4773s-projects.vercel.app
 *
 * 뒤쪽(`-yjh900424-4773s-projects.vercel.app`)은 우리 Vercel 팀 전용 접미사라,
 * 이 패턴에 맞는 주소는 우리 프로젝트의 미리보기뿐이다.
 * 그 밖의 *.vercel.app 주소는 허용하지 않는다.
 */
const VERCEL_PREVIEW = /^https:\/\/mombridge-frontend-[a-z0-9-]+-yjh900424-4773s-projects\.vercel\.app$/;

/** 이 주소에서 온 요청에 CORS를 허용할지 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  // 같은 출처 요청이나 서버 간 호출에는 Origin 헤더가 없다 — 막지 않는다
  if (!origin) return true;
  if (env.CORS_ORIGIN.includes(origin)) return true;
  return VERCEL_PREVIEW.test(origin);
}

/** cors 미들웨어에 넘기는 origin 콜백 */
export const corsOrigin: (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void = (origin, cb) => {
  if (isAllowedOrigin(origin)) cb(null, true);
  else cb(null, false);
};
