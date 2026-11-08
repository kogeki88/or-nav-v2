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
- [x] Emulator: v2.1.1 installs over v2.0.4, opens, "You have the latest version". Signed out there, so the Library screen waits for the phone
- [x] Server with the app's key: tables answer "permission denied" when signed out (before: "does not exist")
- [ ] Phone: update, heading in full, choose a department
- Note: Expo Go cannot run the real-server build (no ExpoSQLite in Expo Go); check real-server screens with the release APK.

## Status
v2.0.1–v2.0.5 published and confirmed on the phone. Part E done (2026-11-08). v2.1.1 published. Next: Sean updates the phone and joins a department.
