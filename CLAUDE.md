# OR-Nav v2 — Master Plan

Offline-first operating room assistant for perioperative and CVOR nurses (scrub and circulator). Native Android: Expo prebuild (React Native) with the `android/` folder committed. Repo: github.com/kogeki88/or-nav-v2 (public).

Also read: `AGENTS.md` (Expo rules: check the SDK 58 docs, never trust memory), `PLAN.md` (current brick).

## Rules
- No shortcuts. No WebView audio, no browser storage the OS can evict. Every brick is production grade.
- One brick at a time. Before code: audit, then update PLAN.md with exact file changes and checks.
- A brick is done only when GitHub Actions builds the signed APK, it is on Releases, and Sean installs it on the phone through the in-app updater.
- Heavy work (scraping, Presidio PHI/PII scrubbing, data compiling) lives in `/tools` CLI scripts. The app in `/src` stays lean, deterministic, no Python, 100% offline.
- No new UI frameworks or heavy dependencies unless asked. Prefer pure TypeScript modules.

## Architecture (ports and adapters, one repo; see `docs/adr/0001-hexagonal-ideas-in-one-repo.md`)
- `src/contracts/`: port interfaces and data types only. No runtime code, no React.
- `src/core/`: logic and adapters (SQLite, Supabase, search, voice). No React or React Native UI. Tests run in Jest without the emulator.
- `src/features/<name>/`: screens and their hooks. Use ports from `src/contracts/` for data. May also import its own folder, shared UI (`src/ui/`) and theme, and old folders (such as the fault log) until they move (Sean, 2026-11-09). Never import `src/core/` or another feature.
- `App.tsx` is the shell: it builds the adapters and passes them in as plain values. No business logic. Add a React Context only when deep screens need several ports.
- One Jest test checks these import rules; `npm test` must pass.
- No event bus until two features must talk and no simpler way works. No pnpm monorepo until a second app needs a part.
- Old code moves into these folders only when a ticket already changes it. New core parts (Brick 3 search, Brick 7 voice) start here with a port.

## Signing key (changed from the original document)
- The release key `android/app/ornav-release.keystore` and `android/keystore.properties` are **never in git** (repo is public).
- CI gets them from GitHub Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
- Sean keeps a backup copy. Losing the key means installed phones can never update again.
- Never run `expo prebuild --clean`: it rebuilds `android/` and wipes the signing and version code in `android/app/build.gradle`. Native changes after Brick 1 go into `android/` by hand or through a config plugin, checked with a cloud build.

## Releasing
- Push a tag `vX.Y.Z`. The workflow sets versionName = X.Y.Z and versionCode = run number, builds, and publishes `or-nav.apk`.
- Phone link: https://github.com/kogeki88/or-nav-v2/releases/latest/download/or-nav.apk
- CI uses Node 22 (Expo SDK 58 needs it) and Java 17 Temurin.

## Test phone (emulator `ornav_pixel`, set up 2026-11-08)
- Runs a DEBUG build of the real app (`com.ornav.app`, debug key). Expo Go cannot run the real app (no ExpoSQLite); use Expo Go only for demo mode.
- The debug APK is built in the cloud: Actions → "Debug APK (test phone)" (`.github/workflows/debug-apk.yml`, manual). Local builds fail: Windows 260-character path limit in the C++ step. Rebuild only after native changes (new native package, `android/` edits).
- Run: `npx expo start --dev-client --port 8081` in this folder, then `"C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081`, then open the app. adb is not on the path: always use this full path, never a variable. JS changes load live from Metro; real Supabase from `.env`.
- Signed in as the test admin account (Sean's "+ornavtest" address; see Supabase → Users) (role admin, profile "Test Nurse", member of Sample General Hospital / Main OR). Sean keeps the password; Claude never types it. If signed out, Sean signs in once.
- The release updater can't install over the debug app (different key); ignore its "Opening the Android installer". To test the updater: uninstall, then `"C:\Users\igles\AppData\Local\Android\Sdk\platform-tools\adb.exe" install` a release APK.
- Driving it with adb: never press Back to hide the keyboard (it can close the app); tap the keyboard's ✓ key instead. Take a screenshot before each tap, because the layout moves.

## Online login (added by Sean, 2026-11-08; not in the original 7 bricks)
- Supabase email + password. Code: `src/auth/supabase.ts`, `src/auth/LoginScreen.tsx`. Session in `expo-sqlite/localStorage` (Expo SDK 58 guide).
- Offline rule: sign in once with internet; the app stays signed in offline until Sign out or Supabase ends the session. OR-Nav keeps its own `ornav.signedInUser` note because `getSession()` returns null offline once the 1-hour token expires.
- Admin (v2.0.4): role = `app_metadata.role` ("admin"), set only in the Supabase dashboard (SQL editor). Admins see a Regular view | Admin view toggle (`src/views/`). The toggle is display only: any later admin feature that changes data must also check `auth.jwt() -> 'app_metadata' ->> 'role'` in RLS. The app re-reads the role from the server on start and on return, so no sign-out is needed after a role change.
- Profile questionnaire (v2.0.5): first sign-in asks name, facility, department, role + fun extras (`src/profile/`). Table `public.profiles` (schema in `supabase/migrations/`, applied by hand in the Supabase SQL editor). RLS: users read/insert/update only their own row; admins read all; no delete. Phone copy `ornav.profile` with `pendingSync` for offline saves. Admin view has "Preview questionnaire" (never saves). New schema changes go in a new numbered migration file.
- Multi-tenant (v2.1 plan, `supabase/migrations/0002_tenants.sql`): all content belongs to a department in a hospital; users read only departments they are members of (pick and go, several allowed). Content tables are never written directly: changes go into `change_requests` and become the truth only through `public.review_change()`, approved by another member of the same department. Hospitals/departments are an admin-only list. Any new content table needs `department_id` + the same RLS.
- "Check for Updates" works on the sign-in screen too, so a broken login can always be fixed by an update.
- Settings: `.env` locally (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, git-ignored); CI secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Only the publishable key, never the secret key.

## AI omnibar (v2.3.0, Sean 2026-11-08; not in the original 7 bricks)
- Edge Function `supabase/functions/omnibar/` (self-contained folder; the app imports `scrub.ts` and `schema.ts` from it). AI keys live only in Supabase secrets: `ANTHROPIC_API_KEY` (Claude Haiku 5.5, first), `GROQ_API_KEY` (free backup `openai/gpt-oss-120b`). Never in the app or git.
- The AI only drafts changes; the nurse sends them for review. The app re-checks every id (`src/omnibar/validate.ts`).
- Every message is scrubbed on the phone and again on the server. Never log message text.
- Deploy: push, then the web editor with one joined `index.ts` (see PLAN Part I); the Supabase CLI sign-in does not work in remote mode.

## Phone database (v2.2.0, Brick 2)
- `src/db/`: SQLite file `ornav.db`, WAL. Schema changes = a NEW numbered entry in `MIGRATIONS` (`src/db/schema.ts`); never edit a shipped one.
- All database calls go through `serial()` in `libraryStore.ts` (one job at a time). Use a plain transaction; do not use `withExclusiveTransactionAsync`.
- The library copy belongs to one user (`sync_meta.user_id`); another account's copy is never shown.

## Fault log (v2.4.0)
- `src/diag/`. Every new catch block that hides an error calls `logFault(area, error)`. Pass the error only: never omnibar message text or anything the user typed.
- Admin view → Run full check / Send report. Reports land in Supabase `fault_reports` (admins read): read them there before guessing at a fault.

## Agent skills

How we build: `C:\Users\igles\phone app\WORKFLOW.md` (grill → spec → tickets → one ticket per fresh session with `/implement`).

### Issue tracker

GitHub Issues on kogeki88/or-nav-v2, with native "blocked by" links. Kanban board: GitHub Project "OR-Nav board". See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults: `needs-triage`, `needs-info`, `ready-for-agent` (AFK), `ready-for-human` (HITL), `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root, made as terms get settled. See `docs/agents/domain.md`.

### Tests

`npm test` (Jest with jest-expo) and `npm run typecheck`. Test files sit beside the code as `*.test.ts`; import `describe`, `it`, `expect` from `@jest/globals`. Both must pass before a ticket is done.

## Look (OR Dark Mode)
Background #0B0F19, cards #111827, accent #38BDF8, text #F8FAFC. Touch targets 48–56dp, in the lower two-thirds of the screen. One screen loop: Search → Preference Card → Scrub Mode, no deep stacks or blocking pop-ups.

## Migration: Salvage & Strangle (from v0.63 PWA)
- Salvage (pure TS): Double Metaphone phonetic search; Dexie v8 models (preference cards, procedures, trays, supply locations, roles); Scrub Mode layout rules, card carousel, Resource Inspector validation.
- Replace: IndexedDB → expo-sqlite (WAL). WebView mic → native audio + local Whisper (whisper.rn / ONNX). Sideloading → GitHub Releases + in-app installer.
- Decision (2026-11-08): Sean does not have the v0.63 source. Brick 2 tables are designed fresh from the list below; nothing is salvaged from Dexie v8.

## The 7 bricks
1. **Self-updating shell + cloud APK pipeline.** `src/updater.ts`, `.github/workflows/release-apk.yml`. (Current)
2. **SQLite engine + v8 schema.** expo-sqlite, WAL. Tables: items, preference_cards, card_items, phonetic_index, schema_migrations. Atomic seed loader. Health (row counts, schema version, size) in a diagnostic drawer.
3. **Double Metaphone search.** `src/engine/phonetic.ts`; primary/secondary codes plus trigram/prefix tokens in SQLite; under 10 ms; results show shelf/sub-location, synonyms, photos/notes.
4. **Preference cards + Scrub Mode.** Group by surgeon, procedure, phase (Setup, Incision, Cannulation/Main, Closure). Scrub Mode: big type, high contrast, swipe carousel, Scrub vs Circulator toggle.
5. **Resource Inspector Studio + bundle sync.** View/audit/edit cards and supplies; import/export signed JSON/SQLite bundles from local storage or a sync endpoint, no app rebuild.
6. **Build-time CLI + Presidio (`/tools/pipeline`).** Python strips PHI/PII from raw notes, compiles clean seed bundles.
7. **Native voice + offline Whisper.** Native audio capture, local speech-to-text, piped into Brick 3 search.
