'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { CameraIcon } from '@/components/ui/icons';

/**
 * 미션 사진 업로드 — 고객사 등록, 운영자 대행 등록·수정에서 같이 쓴다.
 * 끌어서 순서 바꾸기, 대표 지정, 삭제, 진행률.
 * 미션이 아직 없으면(등록 전) 고를 수만 있고, 저장 뒤 missionId가 생기면 그때 올린다.
 */

export const MAX_IMAGES = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface MissionImage { id: string; url: string; sortOrder: number }

/** 미션을 만들기 전 화면에서 고른 파일 (저장 뒤에 올린다) */
export interface PendingImage { key: string; file: File; previewUrl: string }

function reject(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return `${file.name}: jpg·png·webp만 올릴 수 있어요`;
  if (file.size > MAX_BYTES) return `${file.name}: 한 장은 5MB까지예요`;
  return null;
}

export default function MissionImageUploader({
  missionId, pending, onPendingChange,
}: {
  /** 이미 만들어진 미션이면 바로 서버에 올린다 */
  missionId?: string;
  /** 등록 전 화면에서 고른 파일 목록 (missionId가 없을 때 쓴다) */
  pending?: PendingImage[];
  onPendingChange?: (next: PendingImage[]) => void;
}) {
  const [images, setImages] = useState<MissionImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!missionId) return;
    try {
      const { data } = await api.get(`/missions/${missionId}/images`);
      setImages(data.data);
    } catch { /* 편집 권한이 없으면 비워 둔다 */ }
  }, [missionId]);

  useEffect(() => { void load(); }, [load]);

  const count = missionId ? images.length : (pending?.length ?? 0);
  const full = count >= MAX_IMAGES;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const chosen = Array.from(files).slice(0, MAX_IMAGES - count);
    if (chosen.length === 0) { setError(`사진은 최대 ${MAX_IMAGES}장이에요`); return; }

    const bad = chosen.map(reject).find(Boolean);
    if (bad) { setError(bad); return; }

    if (!missionId) {
      // 미션을 만들기 전 — 미리 보기만 쌓아 두고 저장 뒤에 올린다
      const next = chosen.map(file => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      onPendingChange?.([...(pending ?? []), ...next]);
      return;
    }

    setBusy(true);
    try {
      for (let i = 0; i < chosen.length; i++) {
        const body = new FormData();
        body.append('image', chosen[i]);
        await api.post(`/missions/${missionId}/images`, body, {
          onUploadProgress: e => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            setProgress(Math.round(((i + pct / 100) / chosen.length) * 100));
          },
        });
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? '사진을 올리지 못했어요');
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(index: number) {
    setError('');
    if (!missionId) {
      const next = [...(pending ?? [])];
      URL.revokeObjectURL(next[index].previewUrl);
      next.splice(index, 1);
      onPendingChange?.(next);
      return;
    }
    const image = images[index];
    setBusy(true);
    try {
      await api.delete(`/missions/${missionId}/images/${image.id}`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? '사진을 지우지 못했어요');
    } finally { setBusy(false); }
  }

  async function move(from: number, to: number) {
    if (from === to || to < 0 || to >= count) return;
    setError('');
    if (!missionId) {
      const next = [...(pending ?? [])];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onPendingChange?.(next);
      return;
    }
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImages(next); // 먼저 그려 두고 서버에 알린다
    try {
      await api.patch(`/missions/${missionId}/images/order`, { imageIds: next.map(i => i.id) });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? '순서를 바꾸지 못했어요');
      await load();
    }
  }

  const items = missionId
    ? images.map(i => ({ key: i.id, url: i.url }))
    : (pending ?? []).map(p => ({ key: p.key, url: p.previewUrl }));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-[13px] text-muted">사진 (최대 {MAX_IMAGES}장)</label>
        <span className="text-[11px] text-muted">첫 장이 대표 사진이에요</span>
      </div>

      {items.length > 0 && (
        <ul className="mb-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((item, i) => (
            <li
              key={item.key}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragIndex !== null) void move(dragIndex, i); setDragIndex(null); }}
              className="relative"
            >
              <div className={`relative aspect-square overflow-hidden rounded-photo border ${i === 0 ? 'border-clay' : 'border-line'}`}>
                {/* 업로드 직후 주소라 next/image 대신 img를 쓴다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-clay px-1.5 py-0.5 text-[10px] text-paper">대표</span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <div className="flex gap-0.5">
                  <button type="button" aria-label="앞으로" disabled={i === 0 || busy}
                    onClick={() => void move(i, i - 1)}
                    className="h-7 w-7 rounded border border-line text-xs text-ink-2 disabled:opacity-30">←</button>
                  <button type="button" aria-label="뒤로" disabled={i === items.length - 1 || busy}
                    onClick={() => void move(i, i + 1)}
                    className="h-7 w-7 rounded border border-line text-xs text-ink-2 disabled:opacity-30">→</button>
                </div>
                <button type="button" onClick={() => void remove(i)} disabled={busy}
                  className="h-7 rounded border border-line px-2 text-[11px] text-clay-dark disabled:opacity-30">삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 끌어 놓기 영역 — 브라우저 기본 '파일 선택' 버튼 대신 */}
      <div
        onDragOver={e => { e.preventDefault(); if (!full && !busy) setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={e => {
          e.preventDefault();
          setDropping(false);
          if (!full && !busy) void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-photo border border-dashed px-4 py-6 text-center transition-colors ${
          dropping ? 'border-clay bg-clay-tint' : 'border-line bg-cream'
        } ${full || busy ? 'opacity-60' : ''}`}
      >
        <CameraIcon size={26} strokeWidth={1.4} className="mx-auto mb-2 block text-muted" />
        <p className="text-[13px] text-ink-2">
          {full ? `사진은 ${MAX_IMAGES}장까지예요` : '여기로 사진을 끌어다 놓으세요'}
        </p>
        {!full && (
          <>
            <p className="mt-0.5 text-[11px] text-muted">jpg · png · webp · 한 장 5MB까지</p>
            <button
              type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              className="mt-3 inline-flex h-9 items-center rounded-control border border-line bg-paper px-3.5 text-[13px] text-ink-2 disabled:opacity-50"
            >
              {busy ? '올리는 중…' : '사진 고르기'}
            </button>
          </>
        )}
        <input
          ref={inputRef} type="file" accept={ALLOWED.join(',')} multiple className="sr-only"
          onChange={e => void handleFiles(e.target.files)}
          disabled={busy || full}
        />
      </div>

      {progress !== null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={progress}>
          <div className="h-full bg-clay transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {!missionId && items.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">미션을 저장하면 사진이 올라가요.</p>
      )}
      {error && <p className="mt-2 text-[13px] text-clay-dark">{error}</p>}
    </div>
  );
}

/** 미션을 만든 뒤, 등록 화면에서 고른 파일을 차례로 올린다 */
export async function uploadPendingImages(missionId: string, pending: PendingImage[]) {
  for (const item of pending) {
    const body = new FormData();
    body.append('image', item.file);
    await api.post(`/missions/${missionId}/images`, body);
    URL.revokeObjectURL(item.previewUrl);
  }
}
