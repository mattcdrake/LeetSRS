# Repository Guidelines

## Project Structure & Module Organization

LeetSRS is a WXT, React, and TypeScript browser extension. Entry points live in `entrypoints/`; popup views and components are in `entrypoints/popup/`. Put business logic in `services/`, shared types and configuration in `shared/`, React hooks in `hooks/`, and content-script helpers in `utils/content/`. Static extension files and locales belong in `public/`; screenshots and branding belong in `assets/`. Tests are colocated in `__tests__/`, with shared setup and mocks in `test/`.

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

Tests use Vitest, Happy DOM, Testing Library, and WXT's Vitest plugin. Name files `*.test.ts` or `*.test.tsx` and place them in a nearby `__tests__/`. Reuse `test/utils/` helpers and cover behavior changes and bug fixes. Before submitting, run `npm test` and `npm run compile`.

## Architecture Invariants

- Extend `ExtensionMessageMap` in `shared/messages.ts` and register the corresponding typed `onMessage` handler in `entrypoints/background.ts`.
- Persist cards as `StoredCard`; serialize and deserialize at the storage boundary.
- Route schema changes through a new, sequential migration in `services/migrations.ts`.
- Use `formatLocalDate` and `isDueByDate` with `dayStartHour` for review-day comparisons; do not compare raw timestamps.
- Ordinary data mutations must call `markDataUpdated()` through `handleDataUpdate`, or Gist last-write-wins sync may miss them. Add new persisted fields to `ExportData` so sync includes them.

## Commit & Pull Request Guidelines

Use Conventional Commits for commit subjects and pull request titles, such as `fix: clean up animation timeout`. Use standard lowercase types including `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, and `revert`; add an optional scope in parentheses. Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer. Keep subjects concise and imperative. Pull requests should explain user impact, summarize implementation and testing, link issues, and include screenshots for UI changes. Do not commit generated `.output/` or `.wxt/` content.
