# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `mattcdrake/LeetSRS`.
Use the `gh` CLI; infer the repository from the Git remote.

## Conventions

- Publish a ticket or spec: `gh issue create`.
- Fetch a ticket: `gh issue view <number> --comments`; include labels when needed.
- List tickets: `gh issue list` with appropriate state and label filters.
- Apply or remove labels: `gh issue edit <number> --add-label` or `--remove-label`.
- Comment: `gh issue comment <number>`.
- Close: `gh issue close <number>`.
- Keep titles and descriptions concise. For multiline bodies, write the text to a temporary file and pass `--body-file`.
- Represent blocking relationships with GitHub's native issue dependencies, never body text or comments.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding

- The map is an issue labelled `wayfinder:map`, with Notes, Decisions-so-far, and Fog in its body.
- Link child tickets as native GitHub sub-issues. If sub-issues are unavailable, use a task list in the map and `Part of #<map>` in each child.
- Label children `wayfinder:<type>`: `research`, `prototype`, `grilling`, or `task`.
- Add blockers through the issue dependencies API, using the blocker's numeric database ID rather than its issue number or node ID.
- The frontier is the first open child in map order with no open blockers and no assignee.
- Claim a ticket by assigning it to the driving developer.
- Resolve a ticket by recording the answer, closing it, and adding a concise finding and link to the map's Decisions-so-far.
