/* data/changelog.ts — "מה חדש": a short, user-facing Hebrew note for every
 * update, newest first. Shown from the ⓘ button in the top bar, and the
 * entries the user hasn't seen yet pop up after an update.
 *
 * Every user-visible change adds an entry at the TOP with the next `id`.
 * Leave `version` out — the release number is assigned by CI at merge time. */

export interface ChangelogEntry {
  /** Strictly increasing — used to tell which entries are new to this device. */
  id: number;
  /** YYYY-MM-DD */
  date: string;
  version?: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 1, date: '2026-10-26',
    title: 'יומן טבע יוצא לדרך',
    items: [
      'דיווח תצפית שמתחיל בתמונה: התאריך והמיקום נלקחים מהתמונה, ואם אין בה — מהשעה ומה-GPS של הטלפון.',
      'בחירת קטגוריה, שם מין עם השלמה מהדיווחים הקודמים, כמות, "לא בטוח בזיהוי" והערה.',
      'יומן ברשת תמונות עם חיפוש וסינון לפי קטגוריה, ומסך מלא לכל דיווח.',
      'אפשר להתקין את האפליקציה בטלפון, והיא עובדת גם בלי קליטה.',
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]!.id;
