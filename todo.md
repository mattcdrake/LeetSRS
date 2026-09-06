# Issue #244: isolate GitHub transport

https://github.com/mattcdrake/LeetSRS/issues/244

Extract Octokit requests into `infrastructure/github/` and sync persistence into
storage adapters. Keep Gist workflows in services.

## Invariants and exclusions

- Preserve request arguments/responses, error classification, localized Gist
  descriptions, per-operation client lifetime, and module-level sync state.
- Preserve backup reuse, whole-snapshot timestamp comparisons, clock reads,
  partial failures, sequential writes, and network execution inside the write queue.
- Reconcile snapshot metadata with sync storage: one persistence owner per key;
  services retain PAT preservation and imported/local timestamp decisions.
- No timeouts, conflict policy, payload/schema/message changes, or lifecycle fixes.
- Leave changes uncommitted and unstaged. No PR requested.

## Tasks

- [x] 1. Characterize transport arguments and sync side-effect ordering, including
     localization, timestamp fallback, no-change, and failures. Record baseline and
     passing checks/build; leave production code unchanged for this review checkpoint.
- [x] 2. Extract GitHub transport, retaining client creation at existing workflow
     points and service-owned validation/error policy. Move transport-only tests as
     appropriate, retain workflow tests, run checks/build and compare output.
- [ ] 3. Extract sync configuration/status persistence and reconcile snapshot
     metadata access (including data-tracker timestamp access). Preserve raw optional
     metadata versus config defaults and service-owned ordering. Update affected
     guidance and architecture checklists; run checks/build and inspect final diff.

## Results and continuation

- Initial branch: `octo`; workspace clean; issue has no comments.
- Baseline: `npm run check` passed (67 files, 690 tests); production build passed.
  WXT requires a local port unavailable in the sandbox; checks/build succeeded with
  execution escalation. Node v24.19.0.
- Baseline output SHA-256 map: `/tmp/leetsrs-244-baseline-output.json`.
  Temporary evidence only; record comparison results here after each extraction.
- Existing service tests cover push/pull/create/validation/error outcomes; snapshot
  and import/export tests already cover raw fields, PAT restoration and reset order.
- Browser/live GitHub testing has not been performed. Broader smoke testing and
  dependency enforcement remain #247 work.

- Task 1 complete: 10 added characterization cases verify untrimmed validation
  inputs, exact Gist requests, one sync client, localization after export, legacy
  timestamp initialization before export, status clock reads after push/import,
  no-change direction retention, request/import/status/config failures, and busy
  state/error reset. Existing workflow assertions remain intact.
- Task 1 validation: `npm run check` passed (67 files, 700 tests), production build
  passed, and `git diff --check` passed. Manifest, background, content script, and non-popup assets are byte-identical
  to baseline. Popup CSS/JS filenames and popup.html changed; bundle equality is
  not claimed. No production source code changed. No browser or live GitHub testing performed.
- Manifest baseline: permissions `storage`, `alarms`, `activeTab`; host permission
  `*://*.leetcode.com/*`; optional host permission `*://*.leetcode.cn/*`.
  Runtime entrypoints: `popup.html`, `background.js`, `content-scripts/content.js`.
- Task 2 complete: `infrastructure/github/client.ts` owns Octokit construction,
  authentication/Gist requests, and the backup filename. Its methods return the
  original request promises; response/error policy stays in services. Each workflow
  creates its client at the same point and sync reuses it for fetch/update.
- Existing tests remain unchanged at the service boundary: they exercise validation,
  workflow sequencing, and storage outcomes through the real transport adapter and
  mocked Octokit. There were no standalone transport-only tests to relocate.
- Task 2 validation: `npm run check` passed (67 files, 700 tests), production build
  passed, and `git diff --check` passed. Only `background.js` differs from the fresh
  task 2 baseline; manifest, popup, content script and all other assets are
  byte-identical. No browser or live GitHub testing performed.
- Updated AGENTS.md and architecture documentation for transport ownership; #244
  remains unchecked because sync persistence is not yet extracted.
- Temporary task 2 baseline output: `/tmp/leetsrs-244-task2-baseline`.
- Next: task 3. Reconcile sync configuration/status keys currently accessed through
  snapshot metadata and data-tracker; avoid competing raw-key adapters. Keep PAT
  preservation, raw optional metadata versus config defaults, timestamp decisions,
  and write sequencing at their current workflow points.
