# Repository Guidelines

Read [docs/architecture.md](docs/architecture.md) for architecture, ownership, dependency rules, and invariants.

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

In Codex, run `npm test` (including focused tests) and `npm run check` with `sandbox_permissions: "require_escalated"` from the first attempt. WXT's Vitest plugin requires a localhost port that the sandbox blocks. Use the normal tool approval flow; do not repeat the known sandbox failure or report it as a new issue each task.

Tests use Vitest, Happy DOM, Testing Library, and WXT's Vitest plugin. Name files `*.test.ts` or `*.test.tsx` and place them in a nearby `__tests__/`. Check `test/utils/` before adding local test helpers, and reuse an existing helper when it fits. Cover behavior changes and bug fixes. Before submitting, run `npm check`. Don't mention this in the PR description.

## Commit & Pull Request Guidelines

Use Conventional Commits for commit subjects and pull request titles, such as `fix: clean up animation timeout`. Use standard lowercase types including `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, and `revert`; add an optional scope in parentheses. Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer. Keep subjects concise and imperative. For most pull requests, use concise bullet points followed by linked or closing issues; omit section headings such as `Summary` and `Testing` unless the change is genuinely complex. Include screenshots for UI changes. Do not commit generated `.output/` or `.wxt/` content.

## Code Review Guidelines

When reviewing code, follow `.github/code-review-guidelines.md`.
