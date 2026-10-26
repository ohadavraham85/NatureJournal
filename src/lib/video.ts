/* lib/video.ts — short video clips attached to an observation: checks the
 * length and size, and grabs a still frame for the preview. The clip itself
 * is stored as recorded (browsers can't re-encode video cheaply). */

import { newId } from '../db/repository';
import type { MediaRecord } from '../types';

export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|3gp|m4v)$/i.test(file.name);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('לא ניתן לקרוא את הסרטון'));
    v.src = url;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    v.onseeked = () => resolve();
    v.currentTime = t;
  });
}

export async function processVideo(file: File): Promise<MediaRecord> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`הסרטון גדול מדי (עד ${MAX_VIDEO_BYTES / 1024 / 1024}MB)`);
  const url = URL.createObjectURL(file);
  try {
    const v = await loadVideo(url);
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    if (duration > MAX_VIDEO_SECONDS + 1) throw new Error(`הסרטון ארוך מדי — עד ${MAX_VIDEO_SECONDS} שניות`);
    await seek(v, Math.min(0.5, duration / 2 || 0));
    const scale = Math.min(1, 480 / Math.max(v.videoWidth || 480, v.videoHeight || 480));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((v.videoWidth || 480) * scale));
    canvas.height = Math.max(1, Math.round((v.videoHeight || 360) * scale));
    canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const thumb = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.78));
    if (!thumb) throw new Error('לא ניתן ליצור תמונה מהסרטון');
    return {
      id: newId(),
      obsId: '',
      blob: file,
      thumb,
      name: file.name,
      width: v.videoWidth,
      height: v.videoHeight,
      createdAt: new Date().toISOString(),
      kind: 'video',
      mime: file.type || 'video/mp4',
      duration: Math.round(duration),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
