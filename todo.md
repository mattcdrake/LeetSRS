# Extract the queue icon and parallelize reads

Issue: [#270](https://github.com/mattcdrake/LeetSRS/issues/270)

Preserve existing behavior. Committed snapshots (#213/#218) are outside this plan.

## Tasks

- [x] Extract the empty-queue SVG from `entrypoints/popup/views/home/ReviewQueue.tsx` into a new popup-owned `entrypoints/popup/components/LeetSRSLogo.tsx`, preserving its paths, size, color, alignment, and decorative `aria-hidden` behavior. Retain empty-state text coverage in `entrypoints/popup/views/home/__tests__/ReviewQueue.test.tsx`.
- [ ] Read independent export values concurrently in `services/import-export.ts`: cards, stats, settings, Gist metadata, data timestamp, and schema version. Chain note reads from the resolved cards while other reads proceed, and sample the export timestamp after all reads finish. Read PAT, Gist ID, and enabled state concurrently in `getGistSyncConfig()` in `services/github-sync.ts`, retaining nullish defaults. Preserve dependent import/reset reads and all write ordering.
- [ ] Add deferred-read regression coverage in `services/__tests__/import-export-characterization.test.ts` and `services/__tests__/github-sync.test.ts`: independent reads start before a blocked read resolves, notes wait for cards, export time is sampled after all reads, and rejected reads reject the operation. Preserve existing payload, default-value, credential-exclusion, import/reset, and write-order coverage, including `services/__tests__/import-export.test.ts`.
- [ ] Manually verify in a disposable browser profile:
  - [ ] Export populated data and verify the backup contains the expected cards, notes, settings, and Gist configuration without credentials.
  - [ ] Check Gist configuration with empty and populated settings; verify the displayed values remain unchanged.
  - [ ] Check the empty-queue icon and instructions in light/dark themes at popup width; capture screenshots.

## Acceptance criteria

- The empty-queue icon and instructions retain their appearance and accessibility, with the icon owned by the popup.
- Independent reads overlap; dependent reads, exported data shape, defaults, timestamp timing, and write ordering remain correct. Export still makes no committed-snapshot guarantee.
- Relevant regression tests and `npm run check` pass using Node.js 24+; manual scenarios and UI screenshots demonstrate the expected behavior. In Codex, run `npm test` and `npm run check` with escalated sandbox permissions as required by repository instructions.
