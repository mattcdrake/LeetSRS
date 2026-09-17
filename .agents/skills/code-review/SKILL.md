---
name: code-review
description: Review pull requests and code changes for realistic defects, expected behavior, security, performance, design, and meaningful test coverage. Use when asked to review code or assess a change before merging.
---

<!--
Adapted from https://github.com/getsentry/skills/tree/main/skills/code-review
and https://develop.sentry.dev/engineering-practices/code-review/.
Modified for LeetSRS: incorporated code-quality criteria directly;
removed organization-specific procedures and examples; aligned testing and
complexity guidance with AGENTS.md.
Skill source license: LICENSE.
Review-practices source: Copyright 2015-2024 Functional Software, Inc. dba Sentry.
Review-practices terms: https://github.com/getsentry/sentry-docs/blob/master/LICENSE.md.
-->

# Code Review

Reduce meaningful risk without demanding perfect code. Follow `AGENTS.md`; weigh each requested change against its cost.

## Establish Context

- Read the change's purpose, diff, relevant callers, and existing tests. Verify that the implementation delivers the intended behavior.
- Trace suspected defects through the code. Check whether existing invariants or safeguards already prevent them.

## Review Checklist

### Identifying Problems

Look for concrete failures introduced or worsened by the change:

- **Runtime errors:** reachable exceptions, invalid accesses, or broken flows.
- **Performance:** unbounded quadratic work, repeated I/O or queries, and unnecessary allocations on realistic workloads. Identify the costly path and expected input size before calling it a bottleneck.
- **Side effects:** unintended changes to other components, persisted data, or background work.
- **Compatibility:** changes that break supported callers or existing installations.
- **Security:** injection, missing permission or ownership checks, unsafe external input, or exposed secrets. Verify checks at actual trust boundaries rather than demanding duplicate internal validation.

Do not infer defects from patterns alone. Consider ordinary concurrency and retries; exclude invented corruption, impossible navigation, and pathological timing without evidence.

### Design and Simplicity

- Check that responsibilities and data flow make sense together and satisfy current requirements without violating established boundaries.
- Look for unnecessary state, branches, indirection, and duplication. Suggest a simpler approach only when it reduces reasoning or maintenance effort without changing behavior.
- Prefer an equivalent standard operation over custom machinery when it communicates intent more clearly; verify return values, side effects, and failure behavior remain equivalent.
- Keep useful abstractions that separate concerns. Do not trade clarity for fewer lines, force unrelated code into a shared helper, or demand unrelated redesigns.

### Readability and Accidental Complexity

- Check that names communicate purpose and are consistent with nearby code; explain any actual ambiguity instead of enforcing personal naming preferences.
- Look for unused code, leftover debugging, and changes unrelated to the stated purpose.
- Let automated formatting and linting enforce mechanical style. Spend review effort on meaning, behavior, and design choices those tools cannot check.

### Test Coverage

- Check that tests protect expected behavior or the reported defect.
- Request another test only for a distinct, plausible regression or meaningful failure that existing coverage misses.
- Prefer observable behavior and representative cases; avoid implementation mirrors, framework tests, exhaustive permutations, and coverage targets.
- Keep test setup and assertions straightforward; avoid branching or calculations that reproduce the implementation. Use table-driven cases when they simplify distinct, valuable scenarios.
- When permission or ownership behavior changes, check meaningful allowed and denied cases at that boundary.
- Reuse nearby tests and fixtures. Do not demand tests merely because a file changed.

### Long-Term Impact

- When persisted data or public contracts change, check existing data and supported callers against the new behavior, including any required conversion or migration.
- Assess lasting performance and maintenance costs of new dependencies or runtime responsibilities using the actual change and expected workload.

## Feedback Guidelines

- For each defect, give a narrow location, reachable trigger, failure mechanism, and observable impact. Explain what needs to change and why.
- Keep feedback respectful, objective, and actionable. State uncertainty; do not present guesses as established defects.
- Separate blockers from optional suggestions and nits. Base severity on likelihood and consequences, not personal preferences.
- Lead with findings ordered by importance; disclose material validation gaps. Distinguish pre-existing issues from introduced regressions.
- Report no findings when none are supported; there is no quota. Do not manufacture blockers from optional improvements.
