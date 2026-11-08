# OR-Nav v2 — Master Plan

Offline-first operating room assistant for perioperative and CVOR nurses (scrub and circulator). Native Android: Expo prebuild (React Native) with the `android/` folder committed. Repo: github.com/kogeki88/or-nav-v2 (public).

Also read: `AGENTS.md` (Expo rules: check the SDK 58 docs, never trust memory), `PLAN.md` (current brick).

## Rules
- No shortcuts. No WebView audio, no browser storage the OS can evict. Every brick is production grade.
- One brick at a time. Before code: audit, then update PLAN.md with exact file changes and checks.
- A brick is done only when GitHub Actions builds the signed APK, it is on Releases, and Sean installs it on the phone through the in-app updater.
- Heavy work (scraping, Presidio PHI/PII scrubbing, data compiling) lives in `/tools` CLI scripts. The app in `/src` stays lean, deterministic, no Python, 100% offline.
- No new UI frameworks or heavy dependencies unless asked. Prefer pure TypeScript modules.

## Signing key (changed from the original document)
- The release key `android/app/ornav-release.keystore` and `android/keystore.properties` are **never in git** (repo is public).
- CI gets them from GitHub Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
- Sean keeps a backup copy. Losing the key means installed phones can never update again.
- Never run `expo prebuild --clean`: it rebuilds `android/` and wipes the signing and version code in `android/app/build.gradle`. Native changes after Brick 1 go into `android/` by hand or through a config plugin, checked with a cloud build.

## Releasing
- Push a tag `vX.Y.Z`. The workflow sets versionName = X.Y.Z and versionCode = run number, builds, and publishes `or-nav.apk`.
- Phone link: https://github.com/kogeki88/or-nav-v2/releases/latest/download/or-nav.apk
- CI uses Node 22 (Expo SDK 58 needs it) and Java 17 Temurin.

## Online login (added by Sean, 2026-11-08; not in the original 7 bricks)
- Supabase email + password. Code: `src/auth/supabase.ts`, `src/auth/LoginScreen.tsx`. Session in `expo-sqlite/localStorage` (Expo SDK 58 guide).
- Offline rule: sign in once with internet; the app stays signed in offline until Sign out or Supabase ends the session. OR-Nav keeps its own `ornav.signedInUser` note because `getSession()` returns null offline once the 1-hour token expires.
- "Check for Updates" works on the sign-in screen too, so a broken login can always be fixed by an update.
- Settings: `.env` locally (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, git-ignored); CI secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Only the publishable key, never the secret key.

## Look (OR Dark Mode)
Background #0B0F19, cards #111827, accent #38BDF8, text #F8FAFC. Touch targets 48–56dp, in the lower two-thirds of the screen. One screen loop: Search → Preference Card → Scrub Mode, no deep stacks or blocking pop-ups.

## Migration: Salvage & Strangle (from v0.63 PWA)
- Salvage (pure TS): Double Metaphone phonetic search; Dexie v8 models (preference cards, procedures, trays, supply locations, roles); Scrub Mode layout rules, card carousel, Resource Inspector validation.
- Replace: IndexedDB → expo-sqlite (WAL). WebView mic → native audio + local Whisper (whisper.rn / ONNX). Sideloading → GitHub Releases + in-app installer.
- The v0.63 source is not on this PC yet. Ask Sean for it before Brick 2.

## The 7 bricks
1. **Self-updating shell + cloud APK pipeline.** `src/updater.ts`, `.github/workflows/release-apk.yml`. (Current)
2. **SQLite engine + v8 schema.** expo-sqlite, WAL. Tables: items, preference_cards, card_items, phonetic_index, schema_migrations. Atomic seed loader. Health (row counts, schema version, size) in a diagnostic drawer.
3. **Double Metaphone search.** `src/engine/phonetic.ts`; primary/secondary codes plus trigram/prefix tokens in SQLite; under 10 ms; results show shelf/sub-location, synonyms, photos/notes.
4. **Preference cards + Scrub Mode.** Group by surgeon, procedure, phase (Setup, Incision, Cannulation/Main, Closure). Scrub Mode: big type, high contrast, swipe carousel, Scrub vs Circulator toggle.
5. **Resource Inspector Studio + bundle sync.** View/audit/edit cards and supplies; import/export signed JSON/SQLite bundles from local storage or a sync endpoint, no app rebuild.
6. **Build-time CLI + Presidio (`/tools/pipeline`).** Python strips PHI/PII from raw notes, compiles clean seed bundles.
7. **Native voice + offline Whisper.** Native audio capture, local speech-to-text, piped into Brick 3 search.
