# Repository Guidelines

## Project Structure & Module Organization

LeetSRS is a WXT, React, and TypeScript browser extension. Entry points live in `entrypoints/`; popup views and components are in `entrypoints/popup/`. Put business logic in `services/`, domain models and rules in `domain/`, storage foundations in `infrastructure/storage/`, messaging, translations, and sync contracts in `shared/`, popup React hooks in `entrypoints/popup/hooks/`, popup queries in `entrypoints/popup/queries/`, and content-script helpers in `content/`. Static extension files and locales belong in `public/`; screenshots and branding belong in `assets/`. Tests are colocated in `__tests__/`, with shared setup and mocks in `test/`.

## Build, Test, and Development Commands

Use Node.js 24+ and install dependencies with `npm install`.

- `npm run dev` starts WXT in development/watch mode.
- `npm run build` creates a production extension build.
- `npm run zip` packages the extension for distribution.
- `npm test` runs the Vitest suite once.
- `npm run compile` performs TypeScript checking without emitting files.
- `npm run lint` and `npm run format:check` check style.
- `npm run check` checks formatting, lints, type-checks, and tests.

## Coding Style & Naming Conventions

Use TypeScript/TSX, ES modules, two-space indentation, single quotes, and semicolons; Biome enforces these rules. Avoid `any`; prefix intentionally unused names with `_`. Use PascalCase for components (`ReviewQueue.tsx`), `use` plus camelCase for hooks (`useNoteEditor.ts`), and kebab-case for utilities and services (`github-sync.ts`). Keep domain logic out of UI components.

## Testing Guidelines

Tests use Vitest, Happy DOM, Testing Library, and WXT's Vitest plugin. Name files `*.test.ts` or `*.test.tsx` and place them in a nearby `__tests__/`. Check `test/utils/` before adding local test helpers, and reuse an existing helper when it fits. Cover behavior changes and bug fixes. Before submitting, run `npm check`. Don't mention this in the PR description.

## Architecture Invariants

- Extend `ExtensionMessageMap` in `shared/messages.ts` and add the corresponding typed handler in `entrypoints/background/messaging.ts`. Keep background registry policy types in `entrypoints/background/registry-types.ts`; `shared/messages.ts` owns the public contract and transport exports.
- Keep `StoredCard` and card codecs in `infrastructure/storage/card-codec.ts` (snapshot contracts may import the type). Learning workflows use `infrastructure/storage/cards.ts`; preserve loaded records and decode only requested cards.
- Keep card/stat/note storage access in `infrastructure/storage/`; services retain validation, clock/settings reads, and multi-entity write order. Stored records and note keys stay inside persistence except explicit snapshot contracts.
- Keep settings defaults/validation in `domain/settings-policy.ts` and WXT access in `infrastructure/storage/settings.ts`. Services retain concurrent I/O orchestration, per-read browser fallback, and sync timestamp tracking.
- Keep language selection portable in `shared/i18n/language.ts` and browser detection in `infrastructure/browser/language.ts`. Content may read language directly through `infrastructure/storage/translations.ts`; preserve lazy fallback and the existing load lifecycle.
- Route schema changes through a new, sequential migration in `infrastructure/storage/migrations.ts`.
- Use `formatLocalDate` and `isDueByDate` from `domain/review-day.ts` with explicit dates and `dayStartHour` for review-day comparisons; do not compare raw timestamps.
- Keep clock/settings reads and persistence sequencing in services; domain calculations take explicit inputs. Preserve the service-owned FSRS instance and parameters.
- Writes must declare the appropriate `syncTrackingOwner` in the background message registry, or Gist last-write-wins sync may miss them. Add new persisted fields to `ExportData` so sync includes them.

## Commit & Pull Request Guidelines

Use Conventional Commits for commit subjects and pull request titles, such as `fix: clean up animation timeout`. Use standard lowercase types including `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, and `revert`; add an optional scope in parentheses. Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer. Keep subjects concise and imperative. For most pull requests, use concise bullet points followed by linked or closing issues; omit section headings such as `Summary` and `Testing` unless the change is genuinely complex. Include screenshots for UI changes. Do not commit generated `.output/` or `.wxt/` content.

## Code Review Guidelines

When reviewing code, follow `.github/code-review-guidelines.md`.
