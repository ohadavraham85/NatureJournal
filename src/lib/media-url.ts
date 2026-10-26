/* lib/media-url.ts — object URLs for stored photos, cached per media id so
 * re-rendering a grid doesn't leak a fresh URL for every tile each time. */

import { getMedia } from '../db/repository';

const thumbs = new Map<string, string>();
const fulls = new Map<string, string>();

export async function thumbUrl(id: string): Promise<string | null> {
  const cached = thumbs.get(id);
  if (cached) return cached;
  const m = await getMedia(id);
  if (!m) return null;
  const url = URL.createObjectURL(m.thumb);
  thumbs.set(id, url);
  return url;
}

export async function photoUrl(id: string): Promise<string | null> {
  const cached = fulls.get(id);
  if (cached) return cached;
  const m = await getMedia(id);
  if (!m) return null;
  const url = URL.createObjectURL(m.blob);
  fulls.set(id, url);
  return url;
}

/** Fills every `img[data-thumb]` under `root` with its photo. */
export function hydrateThumbs(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img[data-thumb]').forEach((img) => {
    const id = img.dataset.thumb!;
    void thumbUrl(id).then((url) => { if (url) img.src = url; });
  });
}
