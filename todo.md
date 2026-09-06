# Issue #241: isolate learning storage

https://github.com/mattcdrake/LeetSRS/issues/241

Extract card codecs and card/stat/note persistence into narrow infrastructure
modules; remove the cards/stats service cycle. Keep rating, removal, queue, and
statistics orchestration in services.

## Invariants and exclusions

Preserve storage/export/message formats, errors, clock/settings reads, FSRS
singleton lifetime, card-before-stats writes, note-before-card deletion, and
nontransactional failures. Timestamp tracking stays with its existing owners.
StoredCard and note keys belong to persistence, except explicit snapshot contracts.
No migrations, snapshot consistency, recovery, validation changes, settings or
GitHub adapter extraction, commits, staging, or PR creation in this work.

## Tasks

- [x] 1. Characterize rating/removal write ordering and partial failures using real
     storage and services. Record baseline checks/build and manifest; run full checks.
- [x] 2. Extract card codecs and persistence; switch cards and stats projections to
     storage APIs, removing the cycle. Preserve untouched stored records and read
     timing (avoid eagerly decoding/reserializing unrelated cards). Move codec/read
     tests, update imports/mocks and guidance. Run full checks and production build.
- [ ] 3. Extract stat and note persistence, retaining validation and orchestration
     in services. Move persistence tests, retain workflow tests, update architecture
     checklists/roadmap/guidance, and verify full checks/build plus unchanged manifest.

## Results and handoff

- Initial branch: `main`; pre-existing untracked `.agents/` left untouched. No prior todo.
- Read issue body (no comments), repository guidance, architecture, refactor plan,
  and roadmap. #240 calculations are already extracted; #243 snapshot work is deferred.
- Baseline production build passed with the existing large-chunk warning.
- Baseline manifest: MV3; background `background.js`, popup `popup.html`, content
  `content-scripts/content.js` at `document_idle` for `.com`/`.cn`; permissions
  `storage`, `alarms`, `activeTab`; `.com` host permission and optional `.cn` permission.
  Comparison copy: `/tmp/leetsrs-241-baseline-manifest.json`.
- Baseline checks initially hit WXT's sandbox localhost-port restriction after
  formatting/lint/type checks passed; rerun passed all 56 files / 622 tests with
  local port access.
- Task 1 added six workflow tests in `services/__tests__/learning-persistence.test.ts`:
  awaited card/stat writes, awaited note deletion, original error propagation,
  partial persisted state on failures, and unchanged service timestamp ownership.
  The fake browser's reads are cloned to match browser storage copy semantics;
  otherwise its shared object references incorrectly persist an unwritten deletion.
- Final `npm run check` passed (57 files / 628 tests); `git diff --check` passed.
  Production code is unchanged, so the baseline build remains applicable.
- Task 2 extracted unchanged codecs/StoredCard into `infrastructure/storage/card-codec.ts`
  and card access into `infrastructure/storage/cards.ts`. `loadCardStore` retains
  the originally read record privately, decodes on demand, and exposes only an ID
  projection for removal. Save/remove write that same record without re-reading.
- Stats and editor-reset projections now import card persistence directly. The
  card service re-exports `getAllCards` for the existing background handler; it
  retains all scheduling, clock/settings reads, note/stats orchestration and errors.
  Import/export is the explicit StoredCard snapshot exception pending #243.
- Moved five codec tests and three card-read tests beside persistence; retained
  workflow tests in services. Added two persistence tests for untouched legacy/
  malformed records, original loaded-record writes, and ID-only removal.
- Task 2 `npm run check` passed (59 files / 630 tests), production build passed
  with the existing chunk-size warning, and `git diff --check` passed. Manifest
  matches the task 1 baseline byte for byte. Code inspection confirms unchanged
  codec bodies and clock/settings locations; timing/partial-failure tests pass.
- Updated AGENTS.md and local architecture/checklist documents. Architecture
  documents are excluded by the user's Git configuration; no exclusions changed.
- Browser testing has not been performed. Task 2 is complete; next is task 3,
  stat/note persistence extraction and final issue documentation. No commits or staging.
