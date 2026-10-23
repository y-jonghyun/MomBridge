import { env } from '../config/env';

/**
 * Supabase Storage 공개 버킷에 파일을 올리고 지운다.
 * 서비스 키는 서버에서만 쓰며 응답에도 넣지 않는다 (프론트에 절대 노출하지 않는다).
 * 클라이언트 라이브러리 대신 REST API를 그대로 부른다 — 쓰는 기능이 업로드·삭제뿐이라 의존성을 늘리지 않는다.
 */

export const storageConfigured = () => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

const base = () => `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object`;
const authHeaders = () => ({
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
});

/** 공개 버킷의 읽기 주소 */
export function publicUrl(path: string): string {
  return `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
}

export async function uploadObject(path: string, body: Buffer, contentType: string): Promise<string> {
  const res = await fetch(`${base()}/${env.SUPABASE_STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': contentType, 'cache-control': 'public, max-age=31536000' },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    // 저장소가 돌려준 본문에 키가 들어 있지는 않지만, 그대로 흘리지 않고 상태 코드만 남긴다
    throw new Error(`storage upload failed (${res.status})`);
  }
  return publicUrl(path);
}

/** 파일을 지운다. 이미 없으면 조용히 넘어간다 */
export async function deleteObject(path: string): Promise<void> {
  const res = await fetch(`${base()}/${env.SUPABASE_STORAGE_BUCKET}/${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`storage delete failed (${res.status})`);
}
