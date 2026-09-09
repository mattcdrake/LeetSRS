# Remove unknown-field preservation

Issue: [#314](https://github.com/mattcdrake/LeetSRS/issues/314)

Only supported fields are guaranteed; unrecognized fields may be discarded. This issue owns that behavior change and its tests. Coordinate module consolidation with [#312](https://github.com/mattcdrake/LeetSRS/issues/312) and unrelated test pruning with [#311](https://github.com/mattcdrake/LeetSRS/issues/311); paths below reflect the current checkout.

## Tasks

- [x] Simplify `infrastructure/storage/cards/store.ts`, `cards/codec.ts`, and their callers in `services/cards.ts`: remove raw-record retention and special mutation/reference paths needed only for unrelated undecodable records. Retain necessary date conversion and supported-card persistence. Rewrite preservation-only storage tests and extend service coverage to verify add, rate, delay, pause, and removal retain other supported cards and their learning data.
- [x] Replace loose object schemas in `infrastructure/storage/backup.ts` and `domain/backup-import.ts` with ordinary object schemas, explicitly declaring supported envelope/configuration fields. Normalize imported settings using known setting keys instead of copying arbitrary properties; retain `autoClearLeetcode` compatibility and current-setting precedence. Update nearby tests to cover nested extra-field removal for cards, FSRS, notes, stats, grade breakdowns, settings, and Gist configuration while retaining known-field validation and relationship failures.
- [x] Simplify backup persistence in `infrastructure/storage/backup.ts` and `services/import-export.ts`, removing snapshot wrappers and object merges whose only purpose is raw passthrough. Reuse supported card/note/stat persistence, retaining helpers only for concrete responsibilities such as bulk replacement or note ownership. Review `infrastructure/storage/notes.ts`, `stats.ts`, and settings adapters for retention-only code. Update import/export and `services/__tests__/github-sync.test.ts` coverage for supported-data round trips, PAT exclusion/local retention, imported timestamps, validation before replacement, and sync push/pull behavior.
- [x] Simplify retention-only copying in `infrastructure/storage/migrations.ts` without removing or reordering known-field migrations. Rewrite migration assertions and preservation fixtures in `test/utils/backup-mocks.ts`, `services/__tests__/import-export-characterization.test.ts`, and storage tests to use supported records. Keep legacy domain migration, settings compatibility, schema advancement/retry, and meaningful failure coverage; remove exact raw round trips and unrelated malformed-record preservation requirements.
- [ ] Update `docs/architecture.md` as requested by the issue: replace the legacy-field retention contract with supported-field guarantees and align backup ownership text with the resulting implementation. Remove remaining unknown-field preservation requirements from repository documentation and code comments; retain credential, startup-readiness, and background-write ownership guidance.
- [ ] Manually verify the extension with disposable browser profiles and a test Gist.
  - [ ] Seed supported cards on both LeetCode domains, including reviewed/paused cards, notes, stats, and settings; rate, delay, pause/resume, and remove a card. Confirm intended changes and retention of other supported data after reload.
  - [ ] Import a valid backup containing extra nested properties, then export and reload it. Confirm supported values survive and extra properties cause no import failure; inspect the output without requiring their retention.
  - [ ] Import a legacy backup missing card domains and using `autoClearLeetcode`; confirm domain defaults, editor-reset behavior, and current-setting precedence when both setting names exist.
  - [ ] Push and pull through a disposable Gist using a second profile; confirm supported learning data/settings transfer, timestamps remain correct, exports omit the PAT, and importing retains the receiving profile's PAT.
  - [ ] Attempt an import with an invalid supported field or relationship; confirm rejection leaves existing learning data unchanged.

## Acceptance criteria

- No production code, tests, fixtures, or documentation require unknown-field or unrelated undecodable-record preservation; obsolete retention machinery is removed rather than replaced with a generic sanitizer, quarantine, or recovery layer.
- Supported cards, FSRS schedules, notes, stats, settings, and known legacy migrations remain functional. Unknown-field tolerance does not weaken validation of supported import fields or relationships.
- Credential handling, imported timestamps, startup readiness, shared write serialization, and background ownership of learning-data writes remain intact.
- Behavioral regression tests and `npm run check` pass; repository Markdown is formatted with `npm run format:markdown`. Manual scenarios above pass before completion.
- The implementation handoff reports production and test/helper lines added, removed, and net change, excluding generated files and this plan.
