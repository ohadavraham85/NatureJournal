# NatureJournal (יומן טבע) — notes for Claude

- **Talk to the user in Hebrew only.**
- **Every user-visible change adds a "מה חדש" entry** at the top of
  `src/data/changelog.ts` (next `id`, today's date, a short Hebrew title and
  1–3 Hebrew bullet points written for the user, not for developers). Leave
  `version` out — CI assigns the release number at merge time.
- Run `npm run build` (includes `tsc`) before pushing.
- **Every change is merged into `main` without asking** — open a PR from the
  working branch and merge it. Pushing to `main` builds, tags the next
  version (`v1.0.x`) and deploys to GitHub Pages
  (`.github/workflows/build-release.yml`).
- **After merging, check that the "Build & Release" run passed** and tell the
  user which version went live.
- Stack: TypeScript + Vite + vite-plugin-pwa (`src/sw.ts`, injectManifest),
  Dexie/IndexedDB (`src/db/`), all data local and offline-first. Plain DOM
  views in `src/views/`, routed by `src/main.ts`. Many modules are ported from
  the Birds journal (github.com/ohadavraham85/Birds) — check there before
  writing something it already has.
- Design: olive #4E5D2A (top bar, primary), earth #8A5A2B (+ button), background
  #F4F1E8, cards #FFFFFF, text #2B2A24, font Rubik. Category colors and icons
  live in `src/data/categories.ts`. UI text is Hebrew, RTL.
- Species catalog: `src/lib/catalog.ts` downloads, on the user's device, the
  species observed in Israel per category from the iNaturalist API (Hebrew
  names, `locale=he`) into the Dexie `taxa` table; queries live in
  `src/data/catalog-sources.ts`. The cloud sandbox can't reach iNaturalist or
  Wikipedia — test with mocked routes in Playwright.
- Shared journal / sync: `src/sync/` — `state.ts` (always loaded: me, journal
  code, outbox, members, status) and `engine.ts` (Firestore + Storage, lazily
  imported only when a journal code is set). Uses the Birds journal's Firebase
  project (`ohad-avraham-birding-log`), whose rules allow
  `households/{code}/**`: docs in `nature_observations` / `nature_members`,
  photos in Storage `households/{code}/nature-media/`. Codes start with `nj-`.
  Reports carry `reporterId`/`reporterName`; deletes are tombstones
  (`deleted: true`); last edit wins by `updatedAt`.
- Testing sync here: the sandbox proxy breaks Chromium's requests to Firebase
  Storage (curl works) — relay them through curl in Playwright routes. Use
  throwaway `nj-` codes and delete their docs/objects afterwards; never list
  `households/` (other people's journals).
- An observation = place + time + `entries: SpeciesEntry[]` (each with its own
  category/species/quantity/uncertain, `note` and `mediaIds`); `photoIds` is
  every species' media in order (older reports may have media/notes not tied
  to a species — shown on top, moved to the first species when edited). `lib/observation.ts`
  converts the old one-species shape (Dexie v3 upgrade, backups, synced docs
  from older app versions).
- Main's top/bottom follow the bars' measured heights (`--topbar-real`,
  `--tabbar-real`, set in main.ts) — never hard-code bar heights.
- Settings are split into sections (`views/settings.ts`); appearance lives in
  `lib/theme.ts` + the boot script in `index.html`; backup/CSV in `lib/backup.ts`.
- Roadmap: done — report form (multi-species, photos + short videos), journal,
  offline PWA, species catalog ("המאגר הביולוגי של ישראל"), settings
  (design/export/backup), shared journal sync with admin, map tab, gallery
  with full-screen viewer/slideshow.
