/* lib/theme.ts — appearance settings (Settings ← עיצוב): color scheme with
 * optional custom colors, font family, text size and weight. Kept in
 * localStorage so index.html's inline boot script can apply them before the
 * first paint; this module writes the "resolved" form that script reads. */

export interface Scheme {
  id: string;
  label: string;
  primary: string;
  accent: string;
  bg: string;
  card: string;
  ink: string;
  dark?: boolean;
}

export const SCHEMES: Scheme[] = [
  { id: 'olive', label: 'זית ואדמה', primary: '#4E5D2A', accent: '#8A5A2B', bg: '#F4F1E8', card: '#FFFFFF', ink: '#2B2A24' },
  { id: 'forest', label: 'יער', primary: '#2F5D3A', accent: '#A0522D', bg: '#EEF3EC', card: '#FFFFFF', ink: '#1F2A22' },
  { id: 'sea', label: 'ים תיכון', primary: '#2E5D7A', accent: '#C0703A', bg: '#EEF3F6', card: '#FFFFFF', ink: '#1E2A33' },
  { id: 'desert', label: 'מדבר', primary: '#8A5A2B', accent: '#4E5D2A', bg: '#F6EEDF', card: '#FFFFFF', ink: '#2E2418' },
  { id: 'bloom', label: 'פריחה', primary: '#7A3B6E', accent: '#4E7A2B', bg: '#F7F0F4', card: '#FFFFFF', ink: '#2A2229' },
  { id: 'night', label: 'לילה (כהה)', primary: '#4F6A2C', accent: '#9A6334', bg: '#151612', card: '#22241E', ink: '#ECEBE4', dark: true },
];

export const FONTS = [
  { id: 'Rubik', label: 'רוביק (ברירת מחדל)', css: 'Rubik:wght@400;500;700' },
  { id: 'Heebo', label: 'היבו', css: 'Heebo:wght@400;500;700' },
  { id: 'Assistant', label: 'אסיסטנט', css: 'Assistant:wght@400;500;700' },
  { id: 'Noto Sans Hebrew', label: 'נוטו', css: 'Noto+Sans+Hebrew:wght@400;500;700' },
  { id: 'Varela Round', label: 'וארלה מעוגל', css: 'Varela+Round' },
  { id: 'Alef', label: 'אלף', css: 'Alef:wght@400;700' },
  { id: 'system', label: 'גופן המכשיר', css: '' },
] as const;

export const SIZES = [
  { pct: 100, label: 'קטן' },
  { pct: 112.5, label: 'רגיל' },
  { pct: 125, label: 'גדול' },
  { pct: 140, label: 'גדול מאוד' },
  { pct: 160, label: 'ענק' },
] as const;

export interface Appearance {
  scheme: string;
  /** Custom colors on top of the scheme ('' = the scheme's own). */
  primary: string;
  accent: string;
  bg: string;
  ink: string;
  font: string;
  size: number;
  bold: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  scheme: 'olive', primary: '', accent: '', bg: '', ink: '', font: 'Rubik', size: 112.5, bold: false,
};

const KEY = 'nj-appearance';
/** Read by the inline script in index.html — keep the shape in sync with it. */
const RESOLVED_KEY = 'nj-appearance-resolved';

interface Resolved {
  vars: Record<string, string>;
  size: number;
  dark: boolean;
  fontHref: string;
  themeColor: string;
}

export function getAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<Appearance>) } : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function schemeOf(a: Appearance): Scheme {
  return SCHEMES.find((s) => s.id === a.scheme) ?? SCHEMES[0]!;
}

function resolve(a: Appearance): Resolved {
  const s = schemeOf(a);
  const font = FONTS.find((f) => f.id === a.font) ?? FONTS[0];
  const primary = a.primary || s.primary;
  return {
    vars: {
      '--olive': primary,
      '--earth': a.accent || s.accent,
      '--bg': a.bg || s.bg,
      '--card': s.card,
      '--ink': a.ink || s.ink,
      '--font': font.id === 'system' ? 'system-ui' : `'${font.id}'`,
      '--weight-normal': a.bold ? '500' : '400',
      '--weight-medium': a.bold ? '700' : '500',
      '--topbar-ink': s.dark ? '#D9DCCB' : '#E4E8D6',
    },
    size: a.size,
    dark: !!s.dark,
    fontHref: font.css ? `https://fonts.googleapis.com/css2?family=${font.css}&display=swap` : '',
    themeColor: primary,
  };
}

/** Applies resolved settings to the page — same logic as index.html's boot script. */
function applyResolved(r: Resolved): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(r.vars)) root.style.setProperty(k, v);
  root.style.fontSize = `${r.size}%`;
  root.toggleAttribute('data-dark', r.dark);
  const link = document.getElementById('app-font') as HTMLLinkElement | null;
  if (link && r.fontHref && link.href !== r.fontHref) link.href = r.fontHref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r.themeColor);
}

export function setAppearance(a: Appearance): void {
  const r = resolve(a);
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
    localStorage.setItem(RESOLVED_KEY, JSON.stringify(r));
  } catch { /* storage blocked — still apply for this session */ }
  applyResolved(r);
}

/** At startup (the boot script already applied the saved look; this covers a first run). */
export function initTheme(): void {
  applyResolved(resolve(getAppearance()));
}
