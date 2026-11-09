# features

One folder per feature (`src/features/<name>/`): its screens and hooks (ADR 0001).

Rule (checked by `src/folderRules.test.ts`): may import contracts, its own folder, and the shared UI (`src/ui/`) and theme. Never core or another feature.
