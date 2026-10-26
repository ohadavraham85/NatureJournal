/* lib/qr.ts — QR codes for joining a shared journal: draw one (the invite
 * link) and scan one with the camera. Scanning uses the browser's built-in
 * BarcodeDetector (Chrome on Android, Safari 17+ ...); where it's missing,
 * the phone's own camera app reads the code and opens the link instead. */

import qrcode from 'qrcode-generator';
import { icon } from './icons';

export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true }).replace('<svg ', '<svg role="img" aria-label="קוד QR להצטרפות ליומן" ');
}

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

export function canScanQr(): boolean {
  return !!detectorCtor() && !!navigator.mediaDevices?.getUserMedia;
}

/** Opens the camera full-screen; resolves with the first QR code's text, or null if closed. */
export function scanQr(): Promise<string | null> {
  return new Promise((resolve) => {
    const Ctor = detectorCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) { resolve(null); return; }
    const detector = new Ctor({ formats: ['qr_code'] });
    const wrap = document.createElement('div');
    wrap.className = 'qr-scanner';
    wrap.innerHTML = `
      <video playsinline muted></video>
      <div class="qr-frame" aria-hidden="true"></div>
      <p class="qr-hint">מכוונים את המצלמה לקוד ה-QR של היומן</p>
      <button type="button" class="qr-close" aria-label="סגירה">${icon('close', 26, 2.2)}</button>`;
    document.body.appendChild(wrap);
    const video = wrap.querySelector('video')!;
    let stream: MediaStream | null = null;
    let done = false;
    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
      wrap.remove();
      resolve(value);
    };
    wrap.querySelector('.qr-close')!.addEventListener('click', () => finish(null));
    const tick = async (): Promise<void> => {
      if (done) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) { finish(codes[0].rawValue); return; }
        } catch { /* frame not ready — try the next one */ }
      }
      setTimeout(() => void tick(), 200);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (done) { s.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = s;
        void video.play();
        void tick();
      })
      .catch(() => {
        wrap.querySelector('.qr-hint')!.textContent = 'אין גישה למצלמה. אפשר לאשר הרשאת מצלמה, או לסרוק את הקוד עם מצלמת הטלפון.';
      });
  });
}
