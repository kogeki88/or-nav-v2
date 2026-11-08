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
- [ ] Self-update to v2.0.2 on the phone

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

## Status
Build #1 is v2.0.1 (tag v2.0.0 failed on a build.gradle typo and has no release). v2.0.2 (updater fix) and v2.0.3 (login) published and verified. Waiting for Sean to update and test the login on the phone. Do not start Brick 2 until Sean confirms.
