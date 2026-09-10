---
status: accepted
---

# Recover startup migrations from saved input

Startup and backup import share numbered, pure, deterministic transformations of complete versioned datasets. Each migration owns its historical shape checks; the runner does not depend on today's application models. Separate migration-specific loading, destination writes, and source cleanup allow storage layouts and backends to change without moving I/O into transformations.

Persist one original-input snapshot per startup migration before changing destination storage, including all inputs needed to repeat the transformation. Retry from that snapshot after interruption instead of rereading partially changed sources. Finish destination writes, clean obsolete source data, record the completed version, then retire the snapshot; writes and cleanup must be repeatable. A snapshot left after version advancement is retired without replay. Preserve recovery data and block normal data operations until recovery succeeds, including when snapshot creation fails.

This costs temporary storage but avoids requiring transformations to accept partially migrated data or their own output. Keep recovery metadata available throughout storage moves and complete each migration before starting the next. Startup recovery is separate from backup replacement and its failure-restoration policy; imports migrate raw data before current normalization and validation, without writing startup snapshots.

Each migration explicitly defines and tests which historical records it repairs, discards, or rejects; the runner supplies no blanket record policy. Use one version sequence: the code-supported version governs backup compatibility and exports, while the device's completed version tracks startup progress. Recovery snapshots reference that sequence rather than introducing another version system.

The implementation and downstream ownership are specified in [#344](https://github.com/mattcdrake/LeetSRS/issues/344), under [#329](https://github.com/mattcdrake/LeetSRS/issues/329). PRs #343 and #345 are abandoned experiments; their code is not the implementation base.
