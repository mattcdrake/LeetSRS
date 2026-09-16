# Agent Instructions

## References

| Need                          | File                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Setup, development, packaging | [README.md#setup](README.md#setup)                                             |
| Scripts and dependencies      | [package.json](package.json)                                                   |
| CI checks                     | [.github/workflows/ci.yml](.github/workflows/ci.yml)                           |
| PR title conventions          | [.github/workflows/conventional-pr.yml](.github/workflows/conventional-pr.yml) |
| Releases                      | [.github/workflows/release-please.yml](.github/workflows/release-please.yml)   |
| Privacy policy                | [PRIVACY.md](PRIVACY.md)                                                       |

## Commands

| Task               | Command                            |
| ------------------ | ---------------------------------- |
| Test one file      | `npm test -- path/to/file.test.ts` |
| Check changed code | `npx biome check path/to/file.ts`  |
| Check types        | `npm run compile`                  |
| Format Markdown    | `npm run format:markdown`          |
| Full checks        | `npm run check`                    |

- Run full checks before submitting code or configuration changes.
- For documentation-only changes, format Markdown and verify the diff and affected links; skip the full check and tests.
- In Codex, run tests and full checks with `sandbox_permissions: "require_escalated"` from the first attempt; WXT's test setup needs a localhost port.

## Tests

- Add a test only when it catches a plausible regression or meaningful failure that existing tests miss; otherwise, do not add it.
- Prioritize critical user flows, consequential business rules, integration boundaries, realistic edge cases, and known regressions.
- Extend nearby `__tests__/*.test.ts` or `*.test.tsx` coverage before creating another test suite.
- Assert observable behavior; do not mirror implementation details, test trivial getters/setters, or retest framework guarantees.
- Use representative cases; add permutations only when they catch distinct, plausible failures.
- Do not add tests merely to increase coverage or because a file changed.
- Reuse fixtures and service mocks from `test/utils/`.
- Persist test storage changes through storage writes; `test/setup.ts` makes reads return snapshots.

## Edge cases and complexity

- Add branches, validation, retries, synchronization, or abstractions only when a realistic failure justifies their complexity.
- Account for normal interaction, external input, and ordinary background concurrency or retries; scale safeguards to failure likelihood and impact.
- Rely on established internal invariants; validate untrusted input at actual trust boundaries instead of duplicating internal defenses.
- Do not add code or tests for pathological timing, impossible navigation, or invented internal corruption without evidence of a real failure or an explicit request.

## Repository conventions

- Regenerate a missing `.wxt/tsconfig.json` with `npx wxt prepare`; `tsconfig.json` extends it.
- Do not commit generated `.wxt/` or `.output/` files.
- Use GitHub's native issue relationships when marking issues as blocked or blocking.
