/* lib/image.ts — turns a picked/captured photo into what we store: a
 * downscaled JPEG for full-screen viewing plus a small thumbnail for grids.
 * Phone photos are 3–10 MB each; keeping them at ~1920px keeps the local
 * database small enough to hold years of reports. */

import { newId } from '../db/repository';
import type { MediaRecord } from '../types';

const PHOTO_MAX_PX = 1920;
const THUMB_MAX_PX = 480;

async function scaleTo(bmp: ImageBitmap, maxPx: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('לא ניתן לעבד את התמונה');
  return blob;
}

/** createImageBitmap applies the EXIF orientation by default in current
 * browsers, so portrait phone photos come out upright. */
export async function processPhoto(file: File): Promise<MediaRecord> {
  const bmp = await createImageBitmap(file);
  try {
    const [blob, thumb] = await Promise.all([scaleTo(bmp, PHOTO_MAX_PX, 0.85), scaleTo(bmp, THUMB_MAX_PX, 0.78)]);
    return {
      id: newId(),
      obsId: '',
      blob,
      thumb,
      name: file.name,
      width: bmp.width,
      height: bmp.height,
      createdAt: new Date().toISOString(),
    };
  } finally {
    bmp.close();
  }
}
