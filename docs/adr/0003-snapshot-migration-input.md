---
status: accepted
---

# Recover startup migrations from saved input

Startup and backup import share numbered, pure, deterministic transformations of complete versioned datasets. Each migration owns its historical shape checks; the runner does not depend on today's application models. Separate migration-specific loading, destination writes, and source cleanup allow storage layouts and backends to change without moving I/O into transformations.

Persist one original-input snapshot per startup migration before changing destination storage, including all inputs needed to repeat the transformation and cleanup. Reject inputs that cannot be captured as lossless JSON. Store recovery metadata outside the namespace collected by physical layout readers so it never becomes migration input or nests inside later snapshots. Validate completed versions and snapshot metadata against the same sequence before changes; reject malformed, unsupported, stale, or inconsistent snapshots and version gaps without deleting recovery evidence.

Retry from that snapshot after interruption instead of rereading partially changed sources. Finish destination writes, clean obsolete source data, record the completed version, then retire the snapshot; writes and cleanup must be repeatable. A snapshot left after version advancement is retired without replay. Report the failed step and phase, preserve recovery data, and block normal data operations until recovery succeeds, including when snapshot creation fails. Registered background messages and alarms use the existing startup readiness gate; a fresh startup retries after the cause is resolved.

This costs temporary storage but avoids requiring transformations to accept partially migrated data or their own output. Keep recovery metadata available throughout storage moves and complete each migration before starting the next. Startup recovery is separate from backup replacement and its failure-restoration policy; imports migrate raw data before current normalization and validation, without writing startup snapshots. Successful steps are not rolled back, and snapshots are retired rather than retained as backup history.

Each migration explicitly defines and tests which historical records it repairs, discards, or rejects; the runner supplies no blanket record policy. Use one version sequence: the code-supported version governs backup compatibility and exports, while the device's completed version tracks startup progress. Recovery snapshots reference that sequence rather than introducing another version system.

Brought forward from the saved-input recovery decision in [PR #346](https://github.com/mattcdrake/LeetSRS/pull/346). The current work is tracked under [#348](https://github.com/mattcdrake/LeetSRS/issues/348): historical contracts in [#349](https://github.com/mattcdrake/LeetSRS/issues/349), typed persistence in [#350](https://github.com/mattcdrake/LeetSRS/issues/350), raw backup migration in [#351](https://github.com/mattcdrake/LeetSRS/issues/351), and startup recovery in [#352](https://github.com/mattcdrake/LeetSRS/issues/352). Earlier PR code is not the implementation base.
