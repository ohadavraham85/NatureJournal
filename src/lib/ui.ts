/* lib/ui.ts — shared UI helpers: toast, modal, confirm, formatting. */

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string, isError = false, ms = 3000): void {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 24.10.2026, 10:12 */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Short date for cards: "24.10", with the year added when it isn't this year. */
export function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const base = `${d.getDate()}.${d.getMonth() + 1}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}.${String(d.getFullYear()).slice(2)}`;
}

export function fmtCoords(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function toLocalInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(v: string): string | null {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function showModal(content: HTMLElement, extraClass = ''): () => void {
  const root = document.getElementById('modal-root')!;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = `modal ${extraClass}`.trim();
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.appendChild(content);
  backdrop.appendChild(box);
  const close = (): void => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  root.appendChild(backdrop);
  return close;
}

export function confirmDialog(message: string, confirmLabel = 'אישור'): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn btn-danger';
    ok.textContent = confirmLabel;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = 'ביטול';
    actions.append(ok, cancel);
    wrap.append(p, actions);
    const close = showModal(wrap);
    ok.onclick = (): void => { close(); resolve(true); };
    cancel.onclick = (): void => { close(); resolve(false); };
  });
}

export function showImageModal(url: string, caption = ''): void {
  const wrap = document.createElement('div');
  wrap.className = 'image-viewer';
  const img = document.createElement('img');
  img.src = url;
  img.alt = caption;
  wrap.appendChild(img);
  const close = showModal(wrap, 'modal-image');
  wrap.addEventListener('click', close);
}
