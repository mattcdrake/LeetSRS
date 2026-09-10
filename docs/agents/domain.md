# Domain docs

## Layout and reading rules

This repo uses a single-context layout:

- `CONTEXT.md` at the repository root holds domain terminology.
- `docs/adr/` holds architecture decision records.

Before exploring the domain, read `CONTEXT.md` and ADRs relevant to the work.
Continue silently when these files are absent. The domain-modeling skill creates them lazily as terminology and decisions are resolved.

## Vocabulary and decisions

Use the glossary's terms when naming domain concepts in issues, proposals, code, and tests. Reconsider unfamiliar terms or note genuine glossary gaps for domain-modeling.

Explicitly identify any proposal that conflicts with an existing ADR, including the ADR reference and the reason to reconsider it.

When changing a recorded architectural decision, supersede the affected ADR and update current architecture guidance in the same change. Corrections and clarifications may update an ADR in place.
