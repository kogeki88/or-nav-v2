# core

Logic and adapters (SQLite, Supabase, search, voice), grouped by area (ADR 0001). No UI.

Rule (checked by `src/folderRules.test.ts`): may import contracts, other core files and old folders. Never `react`, `react-native` or a feature.
