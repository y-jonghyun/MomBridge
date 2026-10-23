/**
 * 배포 직후 예전 화면이 새 JS 파일을 찾지 못해 나는 오류(ChunkLoadError)는
 * 한 번 새로고침하면 대부분 사라진다. 오류 화면을 띄우는 대신 자동으로 새로고침하되,
 * 새로고침해도 같은 오류가 나면 더 돌지 않고 오류 화면을 보여 준다.
 */
const KEY = 'mb:chunk-reload-at';
/** 이 시간 안에 이미 새로고침했다면 다시 하지 않는다 (무한 반복 방지) */
const COOLDOWN_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const text = `${e?.name ?? ''} ${e?.message ?? ''}`;
  return /ChunkLoadError|Loading chunk \S+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text);
}

/**
 * 청크 오류면 한 번만 새로고침한다.
 * @returns 새로고침을 시작했으면 true (호출한 쪽은 오류 화면을 그리지 않아도 된다)
 */
export function reloadOnceForChunkError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 세션 저장소를 못 쓰면(사생활 보호 모드 등) 반복을 막을 수 없으므로 새로고침하지 않는다
    return false;
  }
  window.location.reload();
  return true;
}
