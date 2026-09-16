# Repository Guidelines

## Commands and checks

See [README.md](README.md#setup) for setup, development, and packaging commands.

- `npm test` runs Vitest once; `npm test -- <path>` runs a focused test file.
- `npm run compile` checks TypeScript; `npm run lint` and `npm run format:check` check code style.
- Before submitting code or configuration changes, run `npm run check`. It checks code style, Markdown formatting, types, and tests; CI also runs the production build separately.
- After editing Markdown, run `npm run format:markdown` across the repository, including formatting fixes outside the edited files. For documentation-only changes, verify the diff and affected links; skip the full check and test suite.

## Workflow

- Follow Biome formatting. Use PascalCase component names, `use` plus camelCase hook names, and kebab-case utility names.
- Cover behavior changes and bugs in nearby `__tests__/*.test.ts` or `*.test.tsx` files. Reuse helpers from `test/utils/`; extend existing coverage and parameterize scenarios with the same setup and assertions.
- Use concise Conventional Commit subjects and PR titles. Keep PR descriptions to concise bullets and linked or closing issues.
- Use GitHub's native issue relationships when marking issues as blocked or blocking.
- For local agent reviews, use Matt Pocock's installed `code-review` skill. Hosted Codex PR reviews use their native workflow and these repository rules.
- Do not commit generated `.output/` or `.wxt/` content.
- Opened issue titles should not use conventional comments. Label newly created issues with the appropriate conventional commit label.

## Gotchas

- TypeScript extends generated `.wxt/tsconfig.json`; the install postscript runs `wxt prepare` to create it.
- In Codex, run `npm test` (including focused tests) and `npm run check` with `sandbox_permissions: "require_escalated"` from the first attempt. WXT's Vitest setup needs a localhost port blocked by the sandbox.
- Shared test setup makes fake browser storage reads return snapshots. Use storage writes to update persisted test data; mutating a returned object does not persist it.

## Architecture maintenance

Before changing runtime responsibilities, dependencies, persistence, or cross-runtime behavior, read [Architecture](docs/architecture.md).

Update the architecture doc only when a change materially alters a major responsibility, boundary, or cross-cutting constraint. Changes that fit the documented architecture require no doc update. The architecture doc must never become a collection of PR summaries.
