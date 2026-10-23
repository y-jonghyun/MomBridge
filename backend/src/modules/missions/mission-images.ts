import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { deleteObject, publicUrl, storageConfigured, uploadObject } from '../../lib/storage';
import { logger } from '../../utils/logger';

/** 미션당 사진 수 상한 */
export const MAX_IMAGES = 5;
/** 장당 원본 크기 상한 */
export const MAX_BYTES = 5 * 1024 * 1024;
/** 긴 변 기준으로 줄일 크기 */
const MAX_EDGE = 1600;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function assertUploadable(file: { mimetype: string; size: number }) {
  if (!ALLOWED.has(file.mimetype)) {
    throw new AppError('UNSUPPORTED_IMAGE', 400, 'jpg·png·webp 사진만 올릴 수 있습니다');
  }
  if (file.size > MAX_BYTES) {
    throw new AppError('IMAGE_TOO_LARGE', 400, '사진 한 장은 5MB까지 올릴 수 있습니다');
  }
}

/**
 * 긴 변 1600px로 줄이고 webp로 바꾼다.
 * sharp는 기본적으로 메타데이터를 들고 가지 않으므로, 결과물에는 EXIF(촬영 위치 등)가 남지 않는다.
 */
export async function toWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: 'error' })
    .rotate() // EXIF 방향만 반영해 돌려놓고 메타데이터는 버린다
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

const storagePathFor = (missionId: string) =>
  `${missionId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;

/** 대표 사진(sortOrder 0)을 미션의 thumbnailUrl에도 반영해 기존 화면이 그대로 동작하게 한다 */
export async function syncThumbnail(missionId: string) {
  const first = await prisma.missionImage.findFirst({
    where: { missionId },
    orderBy: { sortOrder: 'asc' },
    select: { url: true },
  });
  await prisma.mission.update({ where: { id: missionId }, data: { thumbnailUrl: first?.url ?? null } });
}

/** 사진 한 장을 줄여서 저장소에 올리고 행을 만든다 */
export async function addMissionImage(missionId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
  if (!storageConfigured()) {
    throw new AppError('STORAGE_UNAVAILABLE', 503, '사진 저장소가 설정되지 않았습니다. 운영자에게 문의해 주세요');
  }
  assertUploadable(file);

  const count = await prisma.missionImage.count({ where: { missionId } });
  if (count >= MAX_IMAGES) {
    throw new AppError('TOO_MANY_IMAGES', 400, `사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있습니다`);
  }

  let webp: Buffer;
  try {
    webp = await toWebp(file.buffer);
  } catch {
    throw new AppError('UNSUPPORTED_IMAGE', 400, '사진을 읽을 수 없습니다. 다른 파일로 올려 주세요');
  }

  const path = storagePathFor(missionId);
  const url = await uploadObject(path, webp, 'image/webp');

  const image = await prisma.missionImage.create({
    data: { missionId, url, storagePath: path, sortOrder: count },
  });
  await syncThumbnail(missionId);
  return image;
}

/** 사진을 지우고 저장소 파일도 함께 지운다 */
export async function removeMissionImage(missionId: string, imageId: string) {
  const image = await prisma.missionImage.findFirst({ where: { id: imageId, missionId } });
  if (!image) throw new AppError('NOT_FOUND', 404, '사진을 찾을 수 없습니다');

  await prisma.missionImage.delete({ where: { id: image.id } });
  try {
    await deleteObject(image.storagePath);
  } catch (err) {
    // 행은 지웠으므로 화면에는 보이지 않는다. 저장소 파일만 남은 경우는 로그로 남긴다
    logger.warn('mission image file left in storage', { missionId, path: image.storagePath, error: (err as Error).message });
  }
  await resequence(missionId);
  await syncThumbnail(missionId);
}

/** 넘겨받은 순서대로 sortOrder를 다시 매긴다 (첫 장이 대표) */
export async function reorderMissionImages(missionId: string, orderedIds: string[]) {
  const images = await prisma.missionImage.findMany({ where: { missionId }, select: { id: true } });
  const known = new Set(images.map(i => i.id));
  if (orderedIds.length !== images.length || orderedIds.some(id => !known.has(id))) {
    throw new AppError('INVALID_INPUT', 400, '사진 순서가 올바르지 않습니다');
  }
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.missionImage.update({ where: { id }, data: { sortOrder: i } })),
  );
  await syncThumbnail(missionId);
}

/** 중간이 비지 않게 0부터 다시 채운다 */
async function resequence(missionId: string) {
  const images = await prisma.missionImage.findMany({
    where: { missionId }, orderBy: { sortOrder: 'asc' }, select: { id: true },
  });
  await prisma.$transaction(
    images.map((img, i) => prisma.missionImage.update({ where: { id: img.id }, data: { sortOrder: i } })),
  );
}

export { publicUrl };
