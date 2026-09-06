# Code Review Guidelines

Review pull requests concisely. Only mention things that actually matter:

- Bugs, logic errors, or edge cases that will break.
- Security issues.
- Significant performance problems, not micro-optimizations.
- Architectural issues or suggestions that materially improve the design.
- Suggestions that meaningfully improve the code.

Check changes against [the architecture](../docs/architecture.md) and [repository invariants](../AGENTS.md); report concrete violations. Review runtime and type-only dependencies, registration and sync-tracking ownership, and the documented backup and content translation-read boundaries. These checks belong to maintainers and LLM reviewers; do not assume automated boundary enforcement.

Post inline comments only for actionable findings. Do not summarize the PR, post progress checklists, describe correct code, praise changes, or list checks performed. If there are no findings, post one PR comment containing only "LGTM".

Do not comment on naming conventions, missing comments, test coverage suggestions, or vague "could be cleaner" feedback.
