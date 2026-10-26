/* lib/icons.ts — inline stroke SVG icons (24×24 grid, currentColor). */

const PATHS = {
  logo: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z"/><path d="M5 19 13 11"/><path d="M13 11c1.5-2.5 4-3 4.5-1.5S15.5 13 13 11Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.7" r=".9" fill="currentColor" stroke="none"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  journal: '<path d="M4 5.5c2-1 5-1 8 0v13c-3-1-6-1-8 0v-13Z"/><path d="M20 5.5c-2-1-5-1-8 0v13c3-1 6-1 8 0v-13Z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/>',
  leaf: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z"/><path d="M5 19 13 11"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.6M19 13a10 10 0 0 0-2.5-1.7M2 9.5a15 15 0 0 1 5-3M22 9.5A15 15 0 0 0 11 5.1"/><circle cx="12" cy="20" r=".9" fill="currentColor" stroke="none"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  chevron: '<path d="m15 6-6 6 6 6"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 22, strokeWidth = 1.8): string {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** Replaces every `[data-icon]` placeholder in static markup with its SVG. */
export function hydrateIcons(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const size = Number(el.dataset.iconSize) || 22;
    el.innerHTML = icon(el.dataset.icon as IconName, size);
  });
}
