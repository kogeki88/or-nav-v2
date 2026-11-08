# PLAN — Brick 1: self-updating native shell + cloud APK pipeline

## Done means
1. Public repo kogeki88/or-nav-v2 holds the code. No key or password in git.
2. Tag v2.0.1 → green GitHub Action → `or-nav.apk` on Releases.
3. The latest-download link works.
4. Sean installs it. The dark screen shows Installed Version, Build Number, Remote Tag.
5. Tag v2.0.2 → Sean taps Check for Updates → progress bar → installs over the old app.

## Files
| File | What |
| --- | --- |
| `app.json` | `com.ornav.app`, version 2.0.0, versionCode 1, INTERNET + REQUEST_INSTALL_PACKAGES, dark |
| `android/` | From `expo prebuild`, committed |
| `android/app/build.gradle` | Release signing from `keystore.properties` or CI env; version from `ORNAV_VERSION_NAME` / `ORNAV_VERSION_CODE` |
| `src/updater.ts` | GitHub latest release → compare → download with progress → Android installer |
| `App.tsx` | OR Dark Mode screen, auto check on start, Check for Updates button |
| `.github/workflows/release-apk.yml` | Tag `v*` or manual → Node 22 + Java 17 → signed APK → Releases |

## Checks
- [x] `npx tsc --noEmit` passes
- [x] `git ls-files` shows no keystore or keystore.properties
- [x] Action run green, Release has `or-nav.apk` (run 42428805054); APK signature matches ornav-release.keystore
- [x] Sean installed v2.0.1 on the phone; "Check for Updates" showed "GitHub answered 504"
- [x] v2.0.2 fix: retry on 5xx/network (3 tries) + fallback to the releases/latest redirect; Node tests pass (real API, real redirect, forced 504, no network)
- [x] Self-update on the phone (Sean updated v2.0.4 → v2.0.5 in the app, 2026-11-08). Emulator: v2.0.4 found v2.0.5, downloaded 0–100%, opened Android's installer (stopped at the "allow this source" setting, which only Sean may change)

## Part B — v2.0.3 online login (Supabase)
Done means: sign-in screen on first open; create account → confirm email → sign in → "Signed in as …" + Sign out; airplane-mode reopen stays signed in; Check for Updates works on the sign-in screen; no password or token in git.

| File | What |
| --- | --- |
| `src/auth/supabase.ts` | Client (expo-sqlite localStorage), AppState refresh, offline signed-in note, plain-language errors |
| `src/auth/LoginScreen.tsx` | Sign in / Create account form, 56dp targets |
| `src/theme.ts` | OR Dark Mode colors shared by screens |
| `App.tsx` | Sign-in form when signed out; version card + Sign out when signed in |
| `.github/workflows/release-apk.yml` | Writes `.env` from secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle download timeout 10 s → 60 s (v2.0.2 build hit a timeout) |

- [x] `npx tsc --noEmit` passes
- [x] Supabase: reused paused project OR-NAV (org OR-nav, ref lmofpllllkveuxjcstfo), resumed; email sign-up on, confirm email on; Site URL = github.com/kogeki88/or-nav-v2; `.env` + CI secrets set
- [x] Green cloud build v2.0.3; signature matches (v2 block SHA-256 47:80:2B…39:08); app holds the Supabase URL + publishable key, not the secret key
- Note: keytool can't read v2-only APK signatures; use `scratchpad/apkcert.py`-style check (read the APK Signing Block)
- Note: free Supabase pauses after ~1 week idle; signed-in phones keep working, new sign-ins fail until Resume
- [ ] Phone: in-app update to v2.0.3, create account, confirm, sign in, airplane-mode reopen, sign out

## Part C — v2.0.4 admin account + Regular / Admin toggle
Done means: regular account sees no toggle; admin sees Regular view | Admin view (remembered); Admin view shows version, build, remote tag, email, role, user id, session expiry, Supabase host, connection check; role works offline and updates on next open.

| File | What |
| --- | --- |
| `src/auth/role.ts` | `roleOf(user)` from `app_metadata.role` |
| `src/auth/supabase.ts` | role + session expiry in the signed-in note; `refreshSignedInUser()`; `checkConnection()` |
| `src/views/RegularView.tsx`, `AdminView.tsx`, `ViewToggle.tsx`, `UpdatePanel.tsx`, `Row.tsx` | The two views, the switch, the shared update block |
| `App.tsx` | Picks Sign in / Regular / Admin; scrolls |

- [x] Typecheck; `roleOf` Node test (6 cases); local Android bundle export
- [x] Green cloud build v2.0.4; signature matches; no secret key
- [x] Sean created iglesia.sean@gmail.com; `role: admin` set in Supabase (read back)
- [ ] Phone: regular → no toggle; admin → toggle, both views; airplane mode keeps role

## Part D — v2.0.5 first sign-in questionnaire
Done means: signed in with no profile → 4-step questionnaire (You / Work / Role / Fun); Finish saves to Supabase + phone; greeting "Hi, {nickname} {emoji}" and profile card in both views; admin "Preview questionnaire" never saves; offline finish syncs later.

| File | What |
| --- | --- |
| `supabase/migrations/0001_profiles.sql` | `profiles` table + RLS (applied in SQL editor) |
| `src/profile/profile.ts` | Questions, choices, `validateStep`, `toRow` |
| `src/profile/profileStore.ts` | Phone copy + Supabase upsert, offline `pendingSync` |
| `src/profile/Questionnaire.tsx`, `ProfileCard.tsx` | Wizard, answers card, greeting |
| `App.tsx`, `src/views/*` | Questionnaire gate, preview, profile in both views |

- [x] Table + 3 policies + RLS on (read back); anonymous read returns `[]`, anonymous insert refused (401, RLS)
- [x] Typecheck; 13 Node tests; local Android bundle
- [x] Green cloud build v2.0.5; signature matches; no secret key
- [x] Phone: questionnaire on sign-in → greeting + card; preview doesn't save (Sean confirmed 2026-11-08)

## Part E — multi-tenant server structure (Sean, 2026-11-08; replaces the first Brick 2 draft)
Decisions: data belongs to a department in a hospital. Pick and go: a user joins any department, and may join several. Edits are proposals; another member of the same department approves; nobody approves their own. Hospitals and departments are an admin-only list. Job role is display only for now.
Done means: `0002_tenants.sql` applied in Supabase; the test script reports PASSED; no app change yet.

| File | What |
| --- | --- |
| `supabase/migrations/0002_tenants.sql` | hospitals, departments, memberships, items, preference_cards, card_items, change_requests, change_reviews; RLS; `public.review_change()` (the only way a change becomes the truth); `private.apply_change()`; 2 sample hospitals x 2 departments |
| `supabase/tests/0002_tenants_test.sql` | 10 checks with 3 fake nurses; always ends in an error so the test data is undone; message says PASSED or FAILED n |

- [x] 0002_tenants.sql applied in the Supabase SQL editor (2026-11-08, Claude in the built-in browser; file matched git byte for byte)
- [x] Test message: PASSED; read back 2 hospitals x 2 departments, 0 memberships, 0 requests
- Next, one at a time: setup questions pick hospital + department from the list → phone SQLite copy of your departments (old Brick 2 tables, plus department_id) → propose / review screens.

## Part F — v2.1.0 Library, detail sheet, To review (Sean, 2026-11-08)
Done means: tabs Library | To review | Me; search + Cards/Items filter + department switcher (join = pick and go); tap a row → bottom sheet (closes by swipe, dim tap, X, Back); Suggest an edit → proposal → Pending badge; colleague approves/rejects (reject asks twice); offline shows the saved copy; every screen checked on the emulator.

| File | What |
| --- | --- |
| `design/DESIGN.md`, `src/theme.ts` | Design system (calm clinical, dark, Ionicons) and its tokens |
| `src/ui/kit.tsx`, `BottomSheet.tsx`, `TabBar.tsx` | Shared parts; the sheet is drawn in the app window (not a Modal) and measures the keyboard itself |
| `src/library/*` | types, pure logic (Node-tested), Supabase source + offline copy, demo source, `useLibrary`, Library screen, sheets |
| `src/review/ReviewScreen.tsx` | To review tab |
| `App.tsx` | Tabs after sign-in; demo mode (`EXPO_PUBLIC_DEMO=1`, development only) |
| `package.json` | + @expo/vector-icons 15.0.2, expo-font ~58.0.11, react-native-safe-area-context ~5.11.1 (Sean approved each) |

- [x] Typecheck; 7 Node logic tests; release bundle export
- [x] Emulator (Pixel 7, Android 15, Expo Go, demo data): library, item + card sheets, edit with keyboard, send, approve, reject confirm, search, departments, swipe close, Me
- [x] 0002_tenants.sql + test applied (Part E); phone v2.1.0 showed "server is not set up" until then
- [ ] Green cloud build v2.1.0 (adds native modules: expo-font, safe-area-context); signature; no secret key
- [x] Emulator, demo data (2026-11-08): "+" chooser, new card, empty-field message, Pending under Your suggestions, Back closes keyboard before sheet, no-match search, Admin view switch
- [ ] Phone: join a department, suggest an edit, a second account approves
- Emulator notes: Metro's file watcher misses edits on this PC; restart it with `--clear` after changes. Expo Go runs with hot reload off.

## Part G — v2.1.1 fix: cut-off empty-state heading
Sean's Samsung showed "Join your" instead of "Join your department". `src/ui/kit.tsx` EmptyState: title and body get `alignSelf: 'stretch'`.
- [x] Typecheck
- [x] Green cloud build v2.1.1 (run 42510490204); signature 47:80:2B…39:08 matches; no secret key (only the library's "sb_secret_" label)
- [x] Emulator: v2.1.1 installs over v2.0.4, opens, "You have the latest version"
- [x] Test phone, debug build + real server, test admin account (2026-11-08): questionnaire saves; Library shows full "Join your department", no red box; Departments lists 2 hospitals x 2; Join Sample General / Main OR → empty library "Start this department's library"; Me shows Admin badge + Regular/Admin switch
- [x] Server with the app's key: tables answer "permission denied" when signed out (before: "does not exist")
- [ ] Phone: update, heading in full, choose a department
- Note: Expo Go cannot run the real-server build (no ExpoSQLite in Expo Go); check real-server screens with the release APK.

## Part H — v2.2.0 Brick 2: offline library in the phone's own database (Sean, 2026-11-08)
Done means: each joined department's items, cards and card lines live in SQLite tables (`ornav.db`, WAL); a server load replaces the copy in one transaction (all or nothing); airplane mode still opens the Library; Admin view shows a "Phone database" block; sample cards exist on the server for Sample General / Main OR.

| File | What |
| --- | --- |
| `src/db/schema.ts` | Numbered migrations (v1 tables), row conversion. Pure TS, Node-tested |
| `src/db/libraryStore.ts` | Opens `ornav.db` (WAL), runs migrations, `saveLibrary` / `readLibrary` / `dbHealth`; one-at-a-time job queue |
| `src/library/supabaseSource.ts`, `useLibrary.ts` | Phone copy from SQLite instead of one JSON text; the old JSON copy moves in once, then is removed |
| `src/views/AdminView.tsx` | "Phone database": schema, your departments, cards, items, card lines, suggestions, file size, last sync |
| `supabase/seed/sample_main_or.sql` | 16 items, 3 cards, 23 card lines (sample data only); run by hand in the SQL editor; does nothing if Main OR already has items |

- [x] Typecheck; 7 Node tests on real SQLite (node:sqlite): migrations, save/read round trip, replace, failed save keeps the old copy, empty library, broken JSON
- [x] Emulator, debug build + real server: migrations ran (v1), server copy saved (2 hospitals, 4 departments, memberships), Admin "Phone database" block shows v1 of v1, 84 KB, last sync
- [x] Seed applied in Supabase (Sean OK'd, 2026-11-08; editor text matched the file by SHA-256); read back 16 items, 3 cards, 23 card lines; emulator Library shows Cards 3, Items 16
- [x] Airplane mode: closed and reopened → Library shows all cards and items, strip "Offline — showing your saved copy from just now"; a card opens with phases, quantities and shelves
- [x] Green cloud build v2.2.0 (run 42527886777); `or-nav.apk` on Releases; signature 47:80:2B…39:08 matches; no secret key (only the library's "sb_secret_" label); bundle holds the phone database code
- [ ] Sean updates his phone in the app; Library shows the sample cards; airplane-mode reopen still shows them
- Known: on Android, database calls wait while the updater downloads an APK (expo-file-system and expo-sqlite share a native worker). They finish when the download ends. Only matters during a real update; the debug test app always "sees" an update.
- Known: `withExclusiveTransactionAsync` was dropped for a plain transaction on the one connection; the job queue keeps reads out of a save.
- Emulator note: three old Metro servers held ports 8081, 8082, 8095. The test app now loads from port 8099 (debug setting `debug_http_host` = localhost:8099, plus `adb reverse tcp:8099 tcp:8099`).

## Part I — v2.3.0 AI omnibar (Sean, 2026-11-08)
Done means: "Ask OR-Nav" bar above the tabs on every tab → chat sheet; answers with tappable items/cards; edit requests become drafts the nurse sends for review (never applied by the AI); switch department / go to tab; patient-info scrubber on the phone and again on the server; OR jargon understood; 50 messages/person/day; offline falls back to plain search. Model: Claude Haiku 5.5 (Sean's choice). Key only on the server.

| File | What |
| --- | --- |
| `supabase/functions/omnibar/scrub.ts` | HIPAA Safe Harbor–based scrubber, shared by app and server; blocks names and dates of birth, replaces numbers/dates/contacts/addresses |
| `supabase/functions/omnibar/schema.ts` | Answer schema (structured output) + action types, shared |
| `supabase/functions/omnibar/prompt.ts`, `core.ts`, `index.ts` | System prompt + OR glossary; the one Claude call; the Edge Function (login, membership, daily limit, second scrub, library as the user) |
| `supabase/migrations/0003_ai_usage.sql` | `ai_usage` + `use_ai_quota()` (applied 2026-11-08) |
| `src/omnibar/*` | Bar, chat sheet, chat state, action checks (`validate.ts`, Node-tested) |
| `src/library/logic.ts` | To review shows card-line changes (card, item, phase, quantity, open/hold) |

- [x] Scrubber: 53 Node tests (each identifier type; OR talk passes unchanged)
- [x] Action checks + card-line review text: 10 Node tests
- [x] Typecheck (app); function bundle type-checked against the real SDK and supabase-js types
- [x] 0003 applied; read back: RLS on, 1 policy, signed-in can call `use_ai_quota`, anon cannot, users cannot insert
- [x] Function `omnibar` deployed from the dashboard editor as one joined file (same files as git commit 8abac88; SHA-256 checked in the browser). Deploy note: the web editor cannot hold the `../` layout, so `scratchpad`-style join (drop local imports) → one `index.ts`.
- [x] Emulator: bar above tabs; sheet with examples; "pt Smith needs a bovie" blocked on the phone, nothing sent; "where is the bovie" reached the function → "The assistant is not set up yet" (no key yet). Function's "Verify JWT" left ON: it passed the new ECC user token.
- Free backup AI (Sean, 2026-11-08): Groq `openai/gpt-oss-120b` answers when Claude cannot (no key, credit, busy, rate limit, down, 20 s timeout); same prompt, library, schema and scrubbed text; "Backup AI" badge. Gemini free tier rejected: its terms let Google use and human-review free-tier prompts and forbid personal/clinical data. Groq: no retention by default, Zero Data Retention option, US-hosted. Neither free tier has a BAA.
- [x] Fallback: 17 Node tests (order, every failure kind, both fail, timeout, strict schema body, no message text in logs); function type-checked
- [ ] Sean: Groq key in Supabase Secrets (`GROQ_API_KEY`) + Zero Data Retention on in Groq Data Controls
- [ ] Sean: Anthropic key in Supabase → Edge Functions → Secrets (`ANTHROPIC_API_KEY`)
- [ ] 15 jargon requests on the emulator; draft → Send for review → Pending; To review shows the card-line change; airplane mode → plain search
- [ ] Green cloud build v2.3.0; signature; no `sb_secret_` / `sk-ant-` in the bundle
- HIPAA note: the scrubber is a backstop. Full compliance also needs signed BAAs with Anthropic and Supabase (paid plan) — Sean's legal step.

## Status
v2.0.1–v2.0.5 published and confirmed on the phone. Part E done (2026-11-08). v2.2.0 (Brick 2, offline library) published 2026-11-08 and checked on the emulator. Next: Sean updates the phone, joins Sample General Hospital / Main OR, and checks the Library in airplane mode. Then Brick 3 (phonetic search).
