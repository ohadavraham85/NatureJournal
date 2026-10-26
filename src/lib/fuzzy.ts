/* lib/fuzzy.ts — forgiving name matching for search and pick-lists: ignores
 * niqqud, final letters (ך/כ, ם/מ, ן/נ, ף/פ, ץ/צ), hyphens and case, and
 * tolerates a typo or two, so "טף" still finds names starting with "טן". */

const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // niqqud and cantillation
    .replace(/[ךםןףץ]/g, (c) => FINALS[c]!)
    .replace(/[-־'"׳״.,()/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Damerau–Levenshtein (optimal string alignment) distance, capped: returns
 * max+1 as soon as the distance is known to exceed `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

function allowedTypos(len: number): number {
  return len < 2 ? 0 : len <= 4 ? 1 : len <= 8 ? 2 : 3;
}

/** Lower is better; null = no match. 0 exact · 1 starts with · 2 a word
 * starts with · 3 contains · 4+ close spelling (typo distance added). */
export function matchScore(query: string, text: string): number | null {
  const q = normalize(query);
  const t = normalize(text);
  if (!q) return 3;
  if (!t) return null;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  const words = t.split(' ');
  if (words.some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  const max = allowedTypos(q.length);
  if (!max) return null;
  let best = max + 1;
  // Compare against the start of the whole name and of each word, at the
  // typed length (±1, for a missing or extra letter).
  for (const w of [t, ...words]) {
    for (const len of [q.length - 1, q.length, q.length + 1]) {
      if (len < 1 || len > w.length) continue;
      best = Math.min(best, distance(q, w.slice(0, len), max));
      if (best === 1) return 5;
    }
  }
  return best <= max ? 4 + best : null;
}

/** Best score over several names of the same thing (Hebrew, English, scientific). */
export function bestScore(query: string, texts: string[]): number | null {
  let best: number | null = null;
  for (const t of texts) {
    if (!t) continue;
    const s = matchScore(query, t);
    if (s !== null && (best === null || s < best)) best = s;
    if (best === 0) break;
  }
  return best;
}
