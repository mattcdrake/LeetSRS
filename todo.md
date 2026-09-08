# Simplify Gist sync execution

Issue: [#296](https://github.com/mattcdrake/LeetSRS/issues/296)

Step 2 of 4. Build on the existing `services/github-auth.ts` and `services/gist-setup.ts` boundaries; preserve behavior and leave #215's behavioral changes out of scope.

## Tasks

- [x] Add a pure push/pull/no-change decision in `domain/gist-sync.ts`, with explicit remote-content state and local/remote timestamp inputs and an explicit indication when legacy initialization is needed. Keep parsing, storage reads, and clocks in `services/github-sync.ts`. Add focused policy coverage in `domain/__tests__/gist-sync.test.ts` for timestamp ordering, missing timestamps, and fallback pushes; preserve existing date-comparison behavior rather than introducing validation rules.
- [x] Simplify `services/github-sync.ts` to execute the decision through one export/push path, one backup-import pull path, and shared success-status recording. Preserve the captured client/destination, configuration and error results, busy-state cleanup, and storage-read timing. Initialize `dataUpdatedAt` before export only when parsed remote content and local metadata both lack timestamps; missing/empty content and invalid JSON must continue pushing without that initialization. Sample completion time after the transfer, write `lastSyncTime` before direction, and skip direction writes for no-change.
- [ ] Reuse and extend `services/__tests__/github-sync.test.ts` characterization coverage for the consolidated execution. Cover empty/missing content and invalid JSON with missing local metadata, parsed malformed values and invalid timestamps under current behavior, export/import/push failures, and failures at either status write. Retain assertions for transfer-before-status ordering, clock sampling, partial writes, unchanged pull content, previous direction on no-change, configuration changes during a request, and recovery after failure. Parameterize shared scenarios and use `test/utils/deferred.ts` for pending requests.
- [ ] Manually exercise existing Gist setup and sync controls in `entrypoints/popup/views/settings/GistSyncSection.tsx` using a disposable Gist and two browser profiles: connect/create, push a local edit, pull it into the other profile, and sync again without edits. Confirm data restoration, status time/direction, and setup behavior; simulate a failed request and retry to confirm the busy indicator clears and sync recovers. Check an enabled alarm-driven sync still completes through the background workflow.

## Acceptance criteria

- Newer local data pushes, newer remote data pulls, and equal timestamps return no-change while retaining the previous sync direction. Missing/malformed content and legacy timestamps retain their current outcomes and side effects.
- Ongoing sync has fewer repeated execution paths, with independently testable domain policy and no domain dependencies on storage, browser APIs, or services.
- Payload format, backup-based imports, whole-dataset timestamp policy, authentication/setup behavior, and the shared background write queue remain unchanged. Error results, timestamp sampling, write order, partial-write behavior, and busy-state recovery are preserved.
- Relevant regression coverage and `npm run check` pass; the manual scenarios above succeed. These validations remain to be performed during implementation.
