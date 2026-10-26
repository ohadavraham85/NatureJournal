/* lib/install.ts — "install the app" support: keeps Chrome's install prompt
 * (beforeinstallprompt) so an in-app button can open it, and falls back to
 * written instructions where the browser offers no prompt (iPhone/Safari). */

import { showModal, toast } from './ui';
import { icon } from './icons';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Must run at startup, before the browser fires the event. */
export function setupInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    toast('יומן טבע הותקן — הוא נמצא עכשיו במסך הבית');
    listeners.forEach((fn) => fn());
  });
}

export function onInstallStateChanged(fn: () => void): void {
  listeners.add(fn);
}

export async function installApp(): Promise<void> {
  if (deferred) {
    const ev = deferred;
    deferred = null;
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
    listeners.forEach((fn) => fn());
    return;
  }
  showInstallHelp();
}

function showInstallHelp(): void {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const box = document.createElement('div');
  box.innerHTML = `
    <h3>${icon('leaf')} התקנת יומן טבע</h3>
    ${ios ? `
      <ol class="install-steps">
        <li>פותחים את האתר ב-Safari.</li>
        <li>לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה).</li>
        <li>בוחרים "הוספה למסך הבית".</li>
      </ol>` : `
      <ol class="install-steps">
        <li>בכרום לוחצים על ⋮ (שלוש הנקודות למעלה).</li>
        <li>בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".</li>
      </ol>
      <p class="hint">אם כרום כותב שהאפליקציה כבר מותקנת — סוגרים את כרום לגמרי, פותחים מחדש את הקישור ומנסים שוב.</p>`}
    <div class="modal-actions"><button type="button" class="btn btn-primary" data-close>הבנתי</button></div>`;
  const close = showModal(box);
  box.querySelector('[data-close]')!.addEventListener('click', close);
}
