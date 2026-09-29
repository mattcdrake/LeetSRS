---
name: design-system-sync
description: Publish the repo's design system in docs/design-system/ to its claude.ai copy. Use after changing anything under docs/design-system/, or when asked to sync, push or update the claude.ai design system.
---

# Design system sync

`docs/design-system/` is the source of truth. The [claude.ai design system](https://claude.ai/artifact/SHkAWzAUpZ6rPfxWCLjK1W) is a copy for Claude Design and for people browsing it. Sync one way only: repo to claude.ai.

Each file in `docs/design-system/` maps to the same path under `project/` in the artifact, so `docs/design-system/tokens.json` is `project/tokens.json`. The artifact also holds files that are not in the repo: component previews, the cover, the bundle, the font, the logo uploads and the index `project/design-system.json`. Leave them alone unless the change needs them.

This needs Claude's Artifact tool; other agents edit the repo copy and leave the publish to a Claude session.

1. Read the artifact and list its files. If its `project/` copies differ from the repo in ways the repo's history doesn't explain, someone edited it on claude.ai: bring those edits into the repo first, or ask.
2. Publish only the changed files to the artifact's URL in one call: `root` is `docs/design-system`, and `files` maps each `project/<path>` to its `<path>`. Follow the artifact type's instructions that come back with the read, and send `tokens.json` whole.
3. Last, read `project/design-system.json` again, update only its `lastChange` (`by`, `at`, `via`, and a `note` naming the PR), and publish it.
