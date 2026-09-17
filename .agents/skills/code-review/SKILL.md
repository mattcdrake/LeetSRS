---
name: code-review
description: Review pull requests and code changes for realistic defects, expected behavior, security, performance, design, and meaningful test coverage. Use when asked to review code or assess a change before merging.
---

<!--
Adapted from https://github.com/getsentry/skills/tree/main/skills/code-review
and https://develop.sentry.dev/engineering-practices/code-review/.
Modified for LeetSRS: removed organization-specific process and examples;
added evidence requirements and aligned testing and complexity guidance with AGENTS.md.
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
- **Performance:** costly operations on realistic workloads.
- **Side effects:** unintended changes to other components, persisted data, or background work.
- **Compatibility:** changes that break supported callers or existing installations.
- **Security:** injection, access-control gaps, unsafe external input, or exposed secrets.

Do not infer defects from patterns alone. Consider ordinary concurrency and retries; exclude invented corruption, impossible navigation, and pathological timing without evidence.

### Design and Simplicity

- Check component interactions, current requirements, and established boundaries.
- Suggest straightforward simplifications that preserve behavior and improve understanding. Do not trade clarity for fewer lines or demand unrelated redesigns.

### Test Coverage

- Check that tests protect expected behavior or the reported defect.
- Request another test only for a distinct, plausible regression or meaningful failure that existing coverage misses.
- Prefer observable behavior and representative cases; avoid implementation mirrors, framework tests, exhaustive permutations, and coverage targets.
- Reuse nearby tests and fixtures. Do not demand tests merely because a file changed or require separate test-plan paperwork.

### Long-Term Impact

- Assess compatibility, migration behavior, and maintenance costs when persistence, public contracts, dependencies, or runtime responsibilities change materially.
- Flag concrete unresolved consequences without inventing approval gates.

## Feedback Guidelines

- For each defect, give a narrow location, reachable trigger, failure mechanism, and observable impact. Explain what needs to change and why.
- Keep feedback respectful, objective, and actionable. State uncertainty; do not present guesses as established defects.
- Separate blockers from optional suggestions and nits. Base severity on likelihood and consequences, not personal preferences.
- Lead with findings ordered by importance; disclose material validation gaps. Distinguish pre-existing issues from introduced regressions.
- Report no findings when none are supported; there is no quota. Recommend approval when only optional improvements remain.

## References

- [Original skill](https://github.com/getsentry/skills/tree/main/skills/code-review)
- [Source review practices](https://develop.sentry.dev/engineering-practices/code-review/)
