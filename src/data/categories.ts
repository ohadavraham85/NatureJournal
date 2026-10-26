/* data/categories.ts — the fixed observation categories: label, color and icon. */

export type CategoryId = 'mammals' | 'butterflies' | 'plants' | 'reptiles' | 'insects' | 'fungi' | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  /** Short label for the round picker buttons. */
  short: string;
  color: string;
  /** Light tint used behind the icon and as the photo placeholder background. */
  tint: string;
  /** Inner SVG markup on a 24×24 stroke grid (stroke="currentColor"). */
  icon: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'mammals', label: 'יונקים', short: 'יונקים', color: '#7A4E2D', tint: '#EBDDD2',
    icon: '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M8 16c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5c0 1.6-1.4 2.5-4 2.5s-4-.9-4-2.5Z"/>',
  },
  {
    id: 'butterflies', label: 'פרפרים', short: 'פרפרים', color: '#A84A12', tint: '#F3DCCB',
    icon: '<path d="M12 7v11"/><path d="M12 9C10 5 5 4 4 6.5S6 12 12 11.5"/><path d="M12 9c2-4 7-5 8-2.5S18 12 12 11.5"/><path d="M12 12c-3 0-6 2-5 4.5S11 17 12 14"/><path d="M12 12c3 0 6 2 5 4.5S13 17 12 14"/>',
  },
  {
    id: 'plants', label: 'פרחים וצמחים', short: 'פרחים', color: '#8E3B7A', tint: '#EEDAE8',
    icon: '<circle cx="12" cy="9" r="1.8"/><circle cx="12" cy="5.6" r="1.8"/><circle cx="15.2" cy="8" r="1.8"/><circle cx="14" cy="11.6" r="1.8"/><circle cx="10" cy="11.6" r="1.8"/><circle cx="8.8" cy="8" r="1.8"/><path d="M12 13.5V21"/><path d="M12 18c2 0 3-1.5 3.5-3"/>',
  },
  {
    id: 'reptiles', label: 'זוחלים ודו-חיים', short: 'זוחלים', color: '#2F6B3A', tint: '#D6E6D6',
    icon: '<path d="M4 19c4 0 5-2 6-5s2-6 5-7 4 .5 4 2-1 2-3 2-3 2-4 5"/><path d="M8 14.5 6 13M13 16l1.5 2M12 8.5 10.5 7M16.5 8.5l1.5-1.5"/>',
  },
  {
    id: 'insects', label: 'חרקים', short: 'חרקים', color: '#B3261E', tint: '#F2D6D3',
    icon: '<ellipse cx="12" cy="13.5" rx="6" ry="6.5"/><path d="M12 7v13M9 6 7.5 4M15 6l1.5-2"/>',
  },
  {
    id: 'fungi', label: 'פטריות', short: 'פטריות', color: '#6E5E44', tint: '#E6E0D2',
    icon: '<path d="M4 12a8 7 0 0 1 16 0Z"/><path d="M10 12v6a2 2 0 0 0 4 0v-6"/>',
  },
  {
    id: 'other', label: 'אחר', short: 'אחר', color: '#5F6368', tint: '#E3E4E6',
    icon: '<path d="M12 4v16M5 8l14 8M19 8 5 16"/>',
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function category(id: string): Category {
  return BY_ID.get(id as CategoryId) ?? BY_ID.get('other')!;
}

export function categoryIcon(id: string, size = 24, strokeWidth = 1.6): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${category(id).icon}</svg>`;
}
