# Issue #154: Typed background command behavior

## Goal

Replace per-registration wrapper choices in `entrypoints/background/index.ts` with one exhaustively typed message registry. Each `ExtensionMessageMap` message must declare its handler, execution lane, dirty-tracking behavior, and badge-refresh behavior.

## Plan

- [x] Define reusable protocol helper types in `shared/messages.ts` (or a nearby background-message module) that derive each message's input and output from `ExtensionMessageMap` without duplicating request/response types.
  - Distinguish read-only commands from serialized mutations.
  - Declare `markDataUpdated` and `refreshBadge` behavior explicitly for mutations.
  - Require the registry to satisfy a mapped type over every key of `ExtensionMessageMap`, so missing, extra, or incorrectly typed handlers fail compilation.

- [x] Add a message executor/registration helper that:
  - Waits for `readyPromise` before every handler.
  - Runs all storage-changing work through one shared promise queue.
  - Keeps read-only requests outside the mutation queue.
  - Runs declared `markDataUpdated()` and `updateBadge()` effects only after a successful handler.
  - Propagates handler or side-effect failures while keeping the promise queue usable for subsequent commands.
  - Registers every registry entry through `onMessage` while preserving the command-specific request and response types.

- [ ] Replace the manual `onMessage` calls in `entrypoints/background/index.ts` with a single typed registry and registration pass. Declare these policies explicitly:
  - Read-only: `ping`, `getAllCards`, `getReviewQueue`, `getTodayStats`, `getNote`, `getSettings`, `shouldResetEditor`, `getCardStateStats`, `getLastNDaysStats`, `getNextNDaysStats`, `exportData`, `getGistSyncConfig`, `getGistSyncStatus`, `validatePat`, and `validateGistId`.
  - Card writes, `updateSettings`, `importData`, and `resetAllData`: mark data updated and refresh the badge.
  - Note writes: mark data updated without refreshing the badge.
  - Local-only mutations without those effects: `setGistSyncConfig` and `createNewGist`.
  - `triggerGistSync`: serialize it because a pull can replace local data, do not mark the pulled data as a new local edit, and refresh the badge after success.

- [ ] Move dirty tracking out of `services/settings.ts` so `updateSettings()` does not independently call `markDataUpdated()`; the command executor should own that side effect and invoke it exactly once. Keep import/sync internals able to restore a supplied `dataUpdatedAt` without it being overwritten by command policy.

- [ ] Use the same serialized sync execution path for the periodic alarm in `entrypoints/background/index.ts`, including badge refresh after a pull, so alarm-driven sync cannot race message-driven mutations or bypass command policy.

- [ ] Add focused tests for the registry/executor (for example, `entrypoints/background/__tests__/messaging.test.ts`):
  - A representative read waits for readiness but does not enter the mutation queue, mark data updated, or refresh the badge.
  - Concurrent mutations execute in arrival order and apply only their declared side effects.
  - Handler rejection skips success-only side effects, propagates the error, and does not poison the queue.
  - The concrete registry uses `satisfies BackgroundMessageRegistry` to enforce complete, correctly typed message coverage during compilation.

- [ ] Update affected service tests after removing settings-owned dirty tracking, and retain the existing import/export and GitHub sync coverage for timestamp preservation.

- [ ] Verify with `npm test`, `npm run compile`, `npm run lint`, and `npm run format:check`.

## Completion criteria

- Every background command's behavior is visible in one typed registry.
- No persisted-data mutation or sync pull can bypass serialized execution.
- Dirty tracking and badge refresh are centralized and occur only after successful commands that declare them.
- Adding a message to `ExtensionMessageMap` requires adding a correctly typed registry entry.
