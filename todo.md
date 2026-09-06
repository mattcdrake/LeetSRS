# #243 — Backup codecs and snapshot storage

Issue: https://github.com/mattcdrake/LeetSRS/issues/243

Separate backup payload types and existing transformations from concrete storage
access. Keep export/import/reset orchestration in services.

## Invariants and exclusions

Preserve payload fields, pretty JSON serialization, legacy conversion, shallow
validation and errors, schema/clock read locations, sequential storage traversal,
concurrent settings operations, reset/restore order, PAT handling, and sync
timestamps. No stronger validation, atomicity, recovery, revisions, schema changes,
or GitHub transport extraction (#244). Never commit or stage changes.

## Tasks

- [x] 1. Characterize deterministic exports, permissive import preparation,
      clock timing, reset/restore ordering and failures, and PAT behavior. Run
      baseline and final checks/build; leave production code unchanged.
- [ ] 2. Extract payload types and pure import transformations into a portable
      backup codec; keep schema and conditional clock reads in the service at
      their existing positions. Move calculation coverage with the codec, retain
      service sequencing tests, update consumers, and run checks/build.
- [ ] 3. Extract concrete snapshot reads/writes into infrastructure/storage,
      reusing narrow APIs where they preserve raw data. Keep multi-entity workflow
      order in services, update mocks and architecture guidance/checklists, run
      checks/build, and compare production manifest/entrypoints and fixtures.

## Decisions and results

- Fresh start on clean `main`; no existing todo.md. #241/#242 are recorded complete
  in the repository roadmap. Initial checkpoint is task 1 per issue-workflow.
- Baseline checks passed: 63 files, 661 tests. Task 1 checks passed: 64 files,
  675 tests (14 added characterization cases). WXT/Vitest required sandbox
  escalation to bind a localhost port. Formatting, lint, and TypeScript passed.
- Baseline and final production builds passed with the existing large-chunk
  warning. The complete production output was byte-identical, including manifest
  permissions and background/content/popup entrypoints. Production code unchanged.
- Evidence covers exact raw export JSON and credential/orphan-note omission;
  shallow record/array acceptance and legacy-setting precedence; schema/clock
  timing; reset/restore order; intermediate settings timestamps; partial reset
  and restore failures; truthy/empty/missing PAT handling; schema/orphan retention.
- Remaining: task 2 (codec/types), then task 3 (snapshot persistence and guidance).
  Browser testing has not been performed.
