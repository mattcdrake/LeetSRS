# Issue #239: relocate domain models and storage foundations

Keep both steps in one behavior-preserving PR closing #239. Move whole modules;
preserve implementations, public contracts, serialization, migration versions,
side-effect order, clock reads, and runtime lifecycle. Keep messaging,
translations, and sync contracts in `shared/`, and mixed services in `services/`.
Complete mechanical moves before starting responsibility extractions.

- [x] 1. Move `shared/{cards,notes,settings,stats}.ts` to matching `domain/*.ts`
  files. Update all consumers, test imports, and affected guidance/documentation.
  Verify the moved modules are unchanged and run `npm run check` and
  `npm run build`; compare manifest and entrypoint output with the baseline.
- [ ] 2. Move `services/{storage-keys,migrations,data-tracker}.ts` to
  `infrastructure/storage/`, along with existing storage-key and migration tests.
  Update consumers, relative dependencies, mocks, and guidance (including the
  migration path in `AGENTS.md`). Preserve migration bodies and versions, storage
  keys, and timestamp tracking. Run full checks/build, compare manifest and
  entrypoint behavior, and inspect the final diff for changes beyond relocation.
  Finish the corresponding Stage A checklist in `docs/architecture-refactor.md`.

Baseline before step 1: `npm run check` passed (51 files, 592 tests);
`npm run build` passed with the existing large-chunk warning. Build artifacts
are saved locally in `/tmp/leetsrs-239-baseline-build` for comparison.

Step 1 validation: all four moved modules are byte-identical to baseline;
consumer changes are limited to paths and import sorting/formatting. Full checks
passed (51 files, 592 tests), and the production build passed. The manifest,
content script, and popup output are unchanged; the generated background bundle
differs after import sorting. No live-browser smoke test was performed.

Baseline entrypoints: `background.js`, `popup.html`, and
`content-scripts/content.js` (both LeetCode domains, `document_idle`).
Permissions: `storage`, `alarms`, `activeTab`; host access to `*.leetcode.com`,
with optional host access to `*.leetcode.cn`. These remain unchanged.
