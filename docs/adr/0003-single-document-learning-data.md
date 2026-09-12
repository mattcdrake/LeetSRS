---
status: accepted
---

# Use one document for learning data, backups, and sync

Adopt one versioned browser-local document containing cards with their notes, statistics, stored settings, and the data modification timestamp, so related edits and imported replacements use one write and backups share the stored representation. Preserve existing installations and supported backups through one legacy installation bridge and pure version conversions, while deleting the per-migration storage lifecycle, physical-layout modules, intermediate version writes, and superseded persistence wrappers. Settings travel through Gist; connection configuration remains browser-synced and sync status remains local, both outside the document and unaffected by imports.

All browsers sharing a Gist must update before resuming sync; mixed-version writers are unsupported. Keep the background write queue and whole-dataset timestamp policy from ADR-0001 and ADR-0002, and defer catalog identity changes. The [canonical implementation plan](https://github.com/mattcdrake/LeetSRS/issues/371) records the completed transition and deletion criteria.
