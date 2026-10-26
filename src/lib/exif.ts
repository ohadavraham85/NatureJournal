/* lib/exif.ts — minimal, dependency-free EXIF reader for JPEGs: the photo's
 * capture date and GPS position. Based on the Birds journal's date reader,
 * extended with the GPS IFD. Only reads the first ~128KB of the file (where
 * EXIF always lives). Returns nulls for formats without EXIF (PNG, most
 * screenshots) or photos whose metadata was stripped (e.g. by WhatsApp). */

interface IfdEntry { type: number; count: number; inlineStart: number }

export interface ExifInfo {
  date: Date | null;
  lat: number | null;
  lng: number | null;
}

function readIfd(view: DataView, ifdOffset: number, little: boolean): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  if (ifdOffset + 2 > view.byteLength) return entries;
  const count = view.getUint16(ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entryStart = ifdOffset + 2 + i * 12;
    if (entryStart + 12 > view.byteLength) break;
    const tag = view.getUint16(entryStart, little);
    const type = view.getUint16(entryStart + 2, little);
    const cnt = view.getUint32(entryStart + 4, little);
    entries.set(tag, { type, count: cnt, inlineStart: entryStart + 8 });
  }
  return entries;
}

function entryAscii(view: DataView, tiffStart: number, e: IfdEntry, little: boolean): string {
  const byteLen = e.count;
  const dataStart = byteLen <= 4 ? e.inlineStart : tiffStart + view.getUint32(e.inlineStart, little);
  let s = '';
  for (let i = 0; i < byteLen - 1 && dataStart + i < view.byteLength; i++) {
    s += String.fromCharCode(view.getUint8(dataStart + i));
  }
  return s;
}

function entryLong(view: DataView, e: IfdEntry, little: boolean): number {
  return view.getUint32(e.inlineStart, little);
}

/** GPS latitude/longitude: three RATIONALs (degrees, minutes, seconds). */
function entryDms(view: DataView, tiffStart: number, e: IfdEntry, little: boolean): number | null {
  if (e.type !== 5 || e.count < 3) return null;
  const start = tiffStart + view.getUint32(e.inlineStart, little);
  if (start + 24 > view.byteLength) return null;
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const num = view.getUint32(start + i * 8, little);
    const den = view.getUint32(start + i * 8 + 4, little);
    parts.push(den ? num / den : 0);
  }
  return parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
}

function parseExifDateString(s: string): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  const date = new Date(y!, mo! - 1, d, h, mi, se);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTiff(view: DataView, tiffStart: number): ExifInfo {
  const info: ExifInfo = { date: null, lat: null, lng: null };
  if (tiffStart + 8 > view.byteLength) return info;
  const bo = view.getUint16(tiffStart);
  if (bo !== 0x4949 && bo !== 0x4d4d) return info;
  const little = bo === 0x4949;
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return info;
  const ifd0 = readIfd(view, tiffStart + view.getUint32(tiffStart + 4, little), little);

  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) {
    const exifIfd = readIfd(view, tiffStart + entryLong(view, exifPtr, little), little);
    const dto = exifIfd.get(0x9003) || exifIfd.get(0x9004); // DateTimeOriginal / DateTimeDigitized
    if (dto) info.date = parseExifDateString(entryAscii(view, tiffStart, dto, little));
  }
  if (!info.date) {
    const dt = ifd0.get(0x0132); // DateTime (last-modified in-camera)
    if (dt) info.date = parseExifDateString(entryAscii(view, tiffStart, dt, little));
  }

  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const gps = readIfd(view, tiffStart + entryLong(view, gpsPtr, little), little);
    const latRef = gps.get(1), lat = gps.get(2), lngRef = gps.get(3), lng = gps.get(4);
    if (lat && lng) {
      let la = entryDms(view, tiffStart, lat, little);
      let lo = entryDms(view, tiffStart, lng, little);
      if (la != null && lo != null && !(la === 0 && lo === 0)) {
        if (latRef && String.fromCharCode(view.getUint8(latRef.inlineStart)) === 'S') la = -la;
        if (lngRef && String.fromCharCode(view.getUint8(lngRef.inlineStart)) === 'W') lo = -lo;
        info.lat = la;
        info.lng = lo;
      }
    }
  }
  return info;
}

export async function readExif(file: Blob): Promise<ExifInfo> {
  const none: ExifInfo = { date: null, lat: null, lng: null };
  try {
    const buf = await file.slice(0, 131072).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return none;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffd8) { offset += 2; continue; }
      if (marker === 0xffda || marker === 0xffd9) break; // start of scan / EOI — no more metadata ahead
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xffe1) {
        const segStart = offset + 4;
        if (
          segStart + 6 <= view.byteLength &&
          view.getUint32(segStart) === 0x45786966 &&
          view.getUint16(segStart + 4) === 0x0000
        ) {
          return parseTiff(view, segStart + 6);
        }
      }
      offset += 2 + segLen;
    }
  } catch {
    /* truncated/corrupt slice — no metadata available */
  }
  return none;
}
