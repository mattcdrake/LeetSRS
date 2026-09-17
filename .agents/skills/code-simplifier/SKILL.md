---
name: code-simplifier
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving behavior. Use when asked to simplify code, clean up code, refactor for clarity, or improve readability.
---

# Code Simplifier

**Locally modified:** Adapted for LeetSRS from [getsentry/skills](https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md), itself based on [Anthropic's code-simplifier agent](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md). Replaced imported style rules with repository conventions and aligned validation with the project's testing and complexity rules.

Simplify code for clarity, consistency, and maintainability while preserving its behavior. Prefer readable, explicit code over dense or clever solutions.

## Refinement Principles

### Preserve Functionality

Change how the code is written, not what it does. Preserve outputs, side effects, failure behavior, and relevant execution order. Read callers and existing tests before removing behavior that appears redundant.

### Apply Project Standards

Follow [AGENTS.md](../../../AGENTS.md), nearby code, and the repository's formatting and type-checking tools. Do not impose new preferences for function syntax, type annotations, React patterns, or error handling as part of simplification.

### Enhance Clarity

Simplify code structure by:

- Reducing unnecessary complexity and nesting
- Eliminating redundant code and abstractions
- Improving readability through clear variable and function names
- Consolidating related logic when doing so reduces duplication without coupling unrelated concerns
- Removing unnecessary comments that describe obvious code
- Replacing nested ternaries or dense expressions with clearer control flow when that improves understanding
- Choosing clarity over brevity: explicit code is often better than overly compact code

### Maintain Balance

Avoid over-simplification that could:

- Reduce code clarity or maintainability
- Create overly clever solutions that are hard to understand
- Combine too many concerns into single functions or components
- Remove helpful abstractions that improve code organization
- Prioritize fewer lines over readability
- Make the code harder to debug or extend

### Focus Scope

Refine the code the user identifies. Otherwise, focus on recently modified code; do not expand into unrelated cleanup.

Do not introduce speculative validation, retries, synchronization, or abstractions while simplifying. Rely on established internal invariants, but preserve necessary checks at trust boundaries and safeguards for realistic failures.

## Refinement Process

1. Identify the scope and inspect relevant callers, invariants, and existing tests.
2. Make changes with a clear readability or maintenance benefit. Leave code alone when a rewrite only trades one reasonable style for another.
3. Review the diff for unintended behavior changes and unnecessary scope expansion.
4. Run the checks required by AGENTS.md. Add tests only for plausible regressions that existing coverage misses; do not add tests merely because code was refactored.
5. Report significant changes, validation results, and any remaining uncertainty concisely.
