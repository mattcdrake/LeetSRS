# Triage labels

| Canonical role    | Tracker label     | Meaning                                  |
| ----------------- | ----------------- | ---------------------------------------- |
| `bug`             | `bug`             | Something is broken                      |
| `enhancement`     | `enhancement`     | New feature or improvement               |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate             |
| `needs-info`      | `needs-info`      | Waiting on reporter information          |
| `ready-for-agent` | `ready-for-agent` | Fully specified for agent implementation |
| `ready-for-human` | `ready-for-human` | Requires human implementation            |
| `wontfix`         | `wontfix`         | Will not be actioned                     |

When a skill names a triage role, use its tracker label above.

Open triaged issues carry exactly one category (`bug` or `enhancement`) and one state. Use `needs-triage` for unresolved scope, design, or readiness; use `needs-info` when waiting for reporter information. Native dependencies determine whether a specified ticket can start. Closed completed issues retain their category; closure records completion without retroactively assigning readiness.

Refactors, maintenance, performance work, and UI improvements use `enhancement` unless they fix broken behavior, in which case use `bug`.

The other workflow labels are `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task`. Apply them to the map and child types described in [issue-tracker.md](issue-tracker.md).

Release Please owns `autorelease: pending` and `autorelease: tagged`. Preserve these automation labels unchanged during issue cleanup. Together with the workflow labels above, they form the complete repository label set.
