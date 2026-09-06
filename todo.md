# #242 — Settings and translation adapters

Issue: https://github.com/mattcdrake/LeetSRS/issues/242

Separate settings policy from WXT persistence, and portable translation selection
from browser detection and storage-backed loading. Work on branch `adapters`.

## Invariants and exclusions

Preserve defaults, validation order and English errors, language matching/fallback,
concurrent reads/writes/removals, timestamp ownership, and partial-failure behavior.
Resolve browser fallback only when needed, after the relevant storage read.
Keep the content script's direct language read through a narrow infrastructure
adapter; no messaging, live refresh, lifecycle changes, or translated errors.
Preserve public messages, storage/export formats, and clock-read locations.
Do not stage or commit changes. #243/#245 and final boundary checks in #247 remain
separate. Architecture docs and this plan may be Git-ignored local handoff files.

## Tasks

- [x] 1. Characterize settings concurrency, write failure/tracking behavior, and
      lazy language fallback. Run full checks and baseline production build.
- [ ] 2. Extract pure language selection into shared/i18n and browser detection
      and stored translation loading into infrastructure. Move selection tests,
      retain integration coverage, update the content import and guidance.
      Run full checks/build and compare manifests, entrypoints, and behavior.
- [ ] 3. Extract settings defaults/validation into domain and narrow persistence
      into infrastructure/storage. Keep workflow sequencing and timestamp tracking
      in services. Preserve per-read fallback timing and Promise.all behavior;
      update consumers/tests and architecture checklists. Run full checks/build,
      inspect final diff, and record compatibility evidence.

## Results

Step 1 complete. Added 10 tests to existing settings/i18n service suites. They
cover concurrent reads (get/export), concurrent writes/removals, tracking only
after all writes complete, partial-write preservation and skipped tracking on
failure, tracking-error propagation after persistence, and lazy browser fallback
(including language-read failure). No production code changed.

`npm run check` passed: 61 files, 641 tests. WXT/Vitest required sandbox escalation
for local port access. `npm run build` passed with the existing large-chunk warning.
`git diff --check` passed. No browser testing performed.

Next: task 2, language selection and infrastructure adapters. Existing service
integration tests should remain where they exercise settings workflows; move the
translation-loader tests with that loader. Preserve inherited-property behavior
of `in translations` and current case-sensitive matching; do not tighten validation.

Baseline production artifacts (SHA-256, for later comparison):
- `manifest.json`: `2a200bcead96c97eb832bdd66abe8a6c9a029c9673816bd762780dc5c4c6db27`
- `background.js`: `b28b3bc8e39c82d58969edb01ba0a16e8b2323a85758544c08b244c6429dc495`
- `content-scripts/content.js`: `87b87948d601fbf3393a0d7cd1a7d665b5103977bdc0fc2b5b102d03a534eb14`

Manifest permissions: `storage`, `alarms`, `activeTab`; host permission
`*://*.leetcode.com/*`, optional `*://*.leetcode.cn/*`. Entrypoints remain
`background.js`, `content-scripts/content.js`, and `popup.html`.
