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
    id: 4, date: '2026-10-26',
    title: 'רצועות ורשימות בחירה עם חיפוש',
    items: [
      'שם המין והמקום נבחרים מרשימה שנפתחת תוך כדי הקלדה. היא מוצאת את השם הקרוב ביותר גם עם שגיאת כתיב, ובלי קשר לאותיות סופיות או למקפים.',
      'בחירת מין מהמאגר מסמנת גם את הקטגוריה שלו.',
      'הקטגוריות מוצגות כרצועות במקום עיגולים, והיומן ומסך הבית מוצגים כרצועות אופקיות. בכפתור למעלה ביומן אפשר לחזור לרשת תמונות.',
    ],
  },
  {
    id: 3, date: '2026-10-26',
    title: 'התקנה בטלפון',
    items: [
      'נוסף כפתור "התקנת יומן טבע בטלפון" במסך הבית ובהגדרות.',
      'תוקנה בעיה שבגללה כרום חשב שהאפליקציה כבר מותקנת, כשיומן הצפרות מותקן באותו טלפון.',
    ],
  },
  {
    id: 2, date: '2026-10-26',
    title: 'מאגר המינים של ישראל',
    items: [
      'האפליקציה מורידה מ-iNaturalist את רשימת המינים שנצפו בישראל בכל הקטגוריות, עם שמות בעברית, ושומרת אותה לעבודה בלי קליטה.',
      'בדיווח, כשמקלידים שם מין מופיעות הצעות גם מהמאגר, עם השם המדעי.',
      'בטאב "מינים" אפשר לעבור ל"מאגר המינים בישראל", לחפש ולראות אילו מינים כבר ראית. לחיצה על מין פותחת כרטיס עם תמונה, תיאור מוויקיפדיה וכפתור "דיווח על המין".',
    ],
  },
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
