# Hexagonal ideas in one repo, not a monorepo

We follow the ideas of the "Hexagonal Mobile Monorepo" protocol (ports and adapters, logic with no React, tests that run without the emulator), but inside this one repo with plain folders, not a pnpm monorepo of packages. OR-Nav is the only app, so shared packages would save no work, and moving the app would put the cloud build and the signing key at risk (a lost key means installed phones can never update). We split a part into a shared package only when a second app needs it.

## Considered Options

- **Full pnpm monorepo now (rejected).** Moves the app to `apps/mobile-shell/`, changes npm to pnpm and Jest to Vitest, and puts Presidio and Dexie in the app. Presidio stays in `/tools` (no Python in the app), and Dexie is browser storage, which the app bans.

## Consequences

- Import rules are checked by one Jest test, not by ESLint, so `npm test` enforces them with no new add-on.
- No event bus until two features must talk and no simpler way works.
- Old code moves into the new folders only when a ticket already changes it.
- Folders: `src/contracts/` (ports and types), `src/core/` (logic and adapters, no UI), `src/features/<name>/` (screens and hooks); `App.tsx` is the shell and passes adapters as plain values, not through a React Context, until deep screens need several ports.
- `LibrarySource` is the first port moved; Brick 3 (search) and Brick 7 (voice) start as core parts behind ports.
- The protocol's own 3-step build process and per-package CLAUDE.md files are not used; WORKFLOW.md (grill → spec → tickets → `/implement`) is the one process.
