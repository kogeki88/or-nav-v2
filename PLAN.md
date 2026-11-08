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
- [ ] Phone screenshot of Build #1 (no emulator on this PC)
- [ ] Self-update v2.0.1 → v2.0.2 on the phone

## Status
Build #1 is v2.0.1 (tag v2.0.0 failed on a build.gradle typo and has no release; force-push is blocked, so it stays). Waiting for Sean to install. Do not start Brick 2 until Sean confirms Build #1 is installed.
