# Code Review Guidelines

Review pull requests concisely. Only mention things that actually matter:

- Bugs, logic errors, or edge cases that will break.
- Security issues.
- Significant performance problems, not micro-optimizations.
- Architectural issues or suggestions that materially improve the design.
- Suggestions that meaningfully improve the code.
- Low-value tests that only verify mock setup, mirror implementation details, or duplicate coverage without protecting distinct behavior. Explain why the test adds little regression protection and suggest removing, combining, or improving it.

For each bug finding, provide a minimal test case that fails on the reviewed code, showing the expected and actual behavior. Run it when possible; otherwise state that it is unverified. Do not present hypothetical failures as proven bugs.

Check changes against [the architecture](../docs/architecture.md) and [repository invariants](../AGENTS.md); report concrete violations. Review runtime and type-only dependencies, registration and sync-tracking ownership, and the documented backup and content translation-read boundaries. These checks belong to maintainers and LLM reviewers; do not assume automated boundary enforcement.

Post inline comments only for actionable findings. Do not summarize the PR, post progress checklists, describe correct code, praise changes, or list checks performed. If there are no findings, post one PR comment containing only "LGTM".

Do not comment on naming conventions, missing comments, requests for more test coverage, or vague "could be cleaner" feedback. Actionable findings about low-value existing or added tests are allowed.
