# Repository Guidelines

## Build, Test, and Development Commands

Use Node.js 24+ and install dependencies with `npm install`.

- `npm run dev` starts WXT in development/watch mode.
- `npm run build` creates a production extension build.
- `npm run zip` packages the extension for distribution.
- `npm test` runs the Vitest suite once.
- `npm run compile` performs TypeScript checking without emitting files.
- `npm run lint` and `npm run format:check` check style.
- `npm run format:markdown` formats all Markdown files with Prettier, respecting `.prettierignore`.
- `npm run check` checks formatting, lints, type-checks, and tests.

## Coding Style & Naming Conventions

After writing or editing any Markdown file, always run `npm run format:markdown` across the repository, including formatting fixes in files you did not edit.

Use TypeScript/TSX, ES modules, two-space indentation, single quotes, and semicolons; Biome enforces these rules. Avoid `any`; prefix intentionally unused names with `_`. Use PascalCase for components (`ReviewQueue.tsx`), `use` plus camelCase for hooks (`useNoteEditor.ts`), and kebab-case for utilities and services (`github-sync.ts`). Keep domain logic out of UI components.

When changing persistence workflows, calculate and validate related values before writing, and batch related updates to the same storage area into one write where practical.

## Testing Guidelines

In Codex, run `npm test` (including focused tests) and `npm run check` with `sandbox_permissions: "require_escalated"` from the first attempt. WXT's Vitest plugin requires a localhost port that the sandbox blocks. Use the normal tool approval flow; do not repeat the known sandbox failure or report it as a new issue each task.

Tests use Vitest, Happy DOM, Testing Library, and WXT's Vitest plugin. Name files `*.test.ts` or `*.test.tsx` and place them in a nearby `__tests__/`. Check `test/utils/` before adding local test helpers, and reuse an existing helper when it fits. Cover behavior changes and bug fixes. Before submitting code or configuration changes, run `npm run check`. For documentation-only changes, run Markdown formatting and check the diff and affected links; skip the full check and test suite. Don't mention this in the PR description.

Prefer meaningful behavior coverage over test count. Parameterize scenarios that share setup and assertions, and merge overlapping tests when one clear scenario covers the same behavior. Extend existing coverage before adding another test; keep distinct failure paths and invariants explicit, and avoid tables or helpers that make tests harder to read.

## Commit & Pull Request Guidelines

Use Conventional Commits for commit subjects and pull request titles, such as `fix: clean up animation timeout`. Use standard lowercase types including `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, and `revert`; add an optional scope in parentheses. Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer. Keep subjects concise and imperative. For most pull requests, use concise bullet points followed by linked or closing issues; omit section headings such as `Summary` and `Testing` unless the change is genuinely complex. Include screenshots for UI changes. Do not commit generated `.output/` or `.wxt/` content.

## Code Review Rules

Use Matt Pocock's installed `code-review` skill directly. Its upstream source is [code-review/SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md).

## Agent skills

### Issue tracker

Issues live in GitHub Issues. Before tracker operations, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage labels. Before triaging, read `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout. Before exploring the domain, read `docs/agents/domain.md`.

## Architecture boundaries

- Domain owns explicit-input policy and models; services own workflows and side effects; infrastructure owns external I/O and persistence.
- Infrastructure must not depend on services or UI. Domain must not depend on browser, storage, services, messaging, or translation catalogs.
- Popup and content workflows call typed background messages. Content may read translations through its storage adapter.
- Background owns learning-data writes. Services compose domain rules and adapters without dependency cycles.
- UI owns presentation and user interactions; keep domain logic outside components. Dependency rules also apply to type-only imports.

Before changing module dependencies, background execution, content lifecycle, persistence, imports, or sync, read the relevant sections of `docs/agents/architecture.md` and the ADRs they reference.
