# Documentation scrap manifest

Proposed cuts only. No existing documentation has been deleted. This assessment concerns the checked-in content, not who authored it.

## Scrap entire files

| Target                                  | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CONTEXT.md](../CONTEXT.md)             | An unlinked glossary doubles as a product specification. “Avoid: Question” polices vocabulary without explaining a problem; “agreed direction” presents topic-analysis decisions without a linked decision, owner, or implementation. Useful definitions are mixed with speculative requirements. Retire the document rather than treating it as authoritative input to future work.                                                                             |
| [docs/architecture.md](architecture.md) | The document mixes durable boundaries with a prose inventory of implementation details: a 15-second popup timer, cached promises, positional Zod validation, unused SHA files, five-minute sign-in intent expiry, setup cues, and migration behavior. It is expensive to keep synchronized and gives those details the appearance of architectural constraints. Scrap the current text; its accurate facts can be recovered from code and tests when rebuilding. |

## Scrap entire sections or rules

| Target                                                                                     | Reason                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [AGENTS.md](../AGENTS.md): mandatory Matt Pocock `code-review` skill rule                  | Makes a personal, externally installed workflow a repository requirement. The skill is not part of the current advertised skill catalog. Remove the dependency rather than replacing it with another mandated reviewer persona.                                          |
| [AGENTS.md](../AGENTS.md): Architecture maintenance section                                | Requires reading the architecture document before a broad range of changes and maintaining it under subjective criteria. Remove this section with the document; otherwise it leaves a broken prerequisite.                                                               |
| [AGENTS.md](../AGENTS.md): “Opened issue titles should not use conventional comments” rule | “Conventional comments” does not clearly specify an issue-title convention, and “appropriate conventional commit label” does not identify actual labels. Delete the ambiguous instruction. The separate concise PR/commit guidance is useful.                            |
| [README.md](../README.md): current Screenshots section                                     | It advertises a separate Stats screen, while the current popup routes are Home, Cards, and Settings. Retire this screenshot set from the README until it can represent the current product. This does not establish that every underlying image asset should be deleted. |
| [README.md](../README.md): Open Source section                                             | “LeetSRS is open source and accepts contributions” provides no contribution instructions. Delete the empty section.                                                                                                                                                      |
| [README.md](../README.md): current Docs paragraph                                          | Remove the architecture link when its target is deleted. The current paragraph should not survive the documentation reset unchanged.                                                                                                                                     |

## Keep out of the scrap pile

- [PRIVACY.md](../PRIVACY.md), [LICENSE.md](../LICENSE.md), and [CHANGELOG.md](../CHANGELOG.md): disclosures, licensing, and release history have distinct purposes. Nothing in this audit supports deleting them.
- [README.md](../README.md): retain the product introduction, installation, development commands, and sync instructions. In particular, the whole-dataset last-write-wins warning explains a real user consequence.
- [AGENTS.md](../AGENTS.md): retain executable checks, the sandbox testing requirement, storage-test gotchas, generated-file exclusions, and concise contribution conventions. These are concrete operating instructions.
- Source code, tests, workflows, installed skills, and screenshot source assets are outside this documentation deletion proposal.

## Deletion dependencies

Delete the architecture document, its README link, and its AGENTS prerequisite together. No reference to `CONTEXT.md` was found elsewhere in the tracked repository text. Remove this temporary manifest after the cuts are resolved; it should not become another permanent process document.
