# Remove React Query Result Mocks

Related: GitHub issue #139

## Goal

Stop fabricating `UseQueryResult` and `UseMutationResult` objects in tests. Exercise the real hooks through a fresh `QueryClient`, mock the typed `sendMessage` boundary, and delete `test/utils/query-mocks.ts` once no consumers remain.

## Principles

- Treat `sendMessage` as the test boundary for server state.
- Use the real hooks and React Query state transitions in component and hook tests.
- Give every test a fresh `QueryClient`; do not share a client across tests.
- Seed successful query data with `queryClient.setQueryData` when the request itself is irrelevant.
- Mock `sendMessage` when a test needs to verify a request, model an error, or control timing.
- Use a deferred promise to hold queries or mutations pending; do not fake `isLoading` or `isPending` flags.
- Keep child-component mocks when they isolate unrelated rendering, but do not mock `useBackgroundQueries` merely to avoid React Query.
- Avoid replacing `query-mocks.ts` with another helper that reconstructs React Query result types.

## Test infrastructure

- [x] Update `test/utils/test-wrapper.tsx` so the normal wrapper creates and clears a `QueryClient` for each mounted render; document that the advanced explicit-client wrapper must be created per test.
- [x] Consolidate `createWrapper()` and `createTestWrapper()` into one helper that always returns `{ wrapper, queryClient }`. Migrate existing `createWrapper()` consumers and remove the redundant API.
- [x] Add a small deferred-promise test utility for deterministic loading and pending states.
- [x] Keep cache seeding explicit with `queryClient.setQueryData`; a wrapper adds no value yet and can be introduced later if migrations reveal meaningful repetition.
- [x] Establish a typed `sendMessage` mock pattern that returns results by protocol message name without broad `any` casts and rejects unexpected traffic.
- [x] Clear query clients on wrapper unmount. Resolve or reject deferred promises in the test that creates them before unmounting.

## Mutation migration

- [ ] Migrate `hooks/__tests__/useNoteEditor.test.tsx` to real note query and mutation hooks. Seed note data, mock `saveNote`/`deleteNote`, and use deferred promises for saving/deleting state.
- [ ] Migrate `entrypoints/popup/views/card/components/__tests__/CardNotes.test.tsx` to real hooks and the message boundary.
- [ ] Migrate `entrypoints/popup/views/home/__tests__/NotesSection.test.tsx` to real hooks and the message boundary.
- [ ] Migrate `entrypoints/popup/views/home/__tests__/ReviewQueue.test.tsx` to real mutation hooks. Seed queue/settings queries and mock `rateCard`, `removeCard`, `delayCard`, and `setPauseStatus` responses.
- [ ] Migrate `entrypoints/popup/views/card/__tests__/CardView.test.tsx` to real pause/remove mutations and verify protocol payloads where behavior depends on them.
- [ ] Migrate `entrypoints/popup/views/settings/__tests__/DataSection.test.tsx` to real export/import/reset mutations, including pending, success, rejection, and browser-dialog behavior.
- [ ] Remove all mutation `ReturnType<typeof use...Mutation>` assertions.
- [ ] Delete `createMutationMock`, `createPendingMutationMock`, `createSuccessMutationMock`, and `createErrorMutationMock` after their consumers are gone.

## Query migration

- [ ] Migrate `entrypoints/popup/views/card/__tests__/CardView.test.tsx` from `createQueryMock` to seeded cache data or controlled `getAllCards` responses.
- [ ] Migrate `entrypoints/popup/views/home/__tests__/ReviewQueue.test.tsx` from `createQueryMock` to seeded queue/settings data or controlled messages.
- [ ] Migrate `entrypoints/popup/views/home/__tests__/StatsBar.test.tsx` to the real review-queue query.
- [ ] Migrate `entrypoints/popup/components/__tests__/StreakCounter.test.tsx` to the real today-stats query.
- [ ] Migrate `entrypoints/popup/views/stats/__tests__/CardDistributionChart.test.tsx` to the real card-state-stats query.
- [ ] Migrate `entrypoints/popup/views/stats/__tests__/ReviewHistoryChart.test.tsx` to the real last-N-days query.
- [ ] Migrate `entrypoints/popup/views/stats/__tests__/UpcomingReviewsChart.test.tsx` to the real next-N-days query.
- [ ] Migrate the note-related tests above from `createQueryMock` while migrating their mutations.
- [ ] Model loading with unresolved deferred responses and errors with rejected responses instead of overriding query status fields.
- [ ] Remove all `UseQueryResult` and query-hook `ReturnType` assertions from tests.
- [ ] Delete `createQueryMock` and then delete `test/utils/query-mocks.ts`.

## Test ownership cleanup

- [ ] Keep protocol wiring, mutation invalidation, and query-key behavior covered in `hooks/__tests__/useBackgroundQueries.test.tsx`.
- [ ] Remove duplicate low-level hook assertions from component tests once the real hooks make them redundant; retain user-visible behavior and message-payload assertions.
- [ ] Review mocked child components after each migration and keep only mocks that isolate expensive or unrelated UI behavior.
- [ ] Search for remaining full-module mocks of `@/hooks/useBackgroundQueries` and justify or remove each one.
- [ ] Search for remaining casts to React Query result types and eliminate them where possible.

## Suggested order

1. Improve the wrapper and add deferred/message-boundary test utilities.
2. Migrate `DataSection` as a small mutation-only proof of the pattern.
3. Migrate the note tests together to avoid maintaining two approaches around `useNoteEditor`.
4. Migrate `CardView` and `ReviewQueue`, which combine queries and mutations.
5. Migrate the query-only stats and chart tests.
6. Delete `query-mocks.ts`, run the repository-wide searches below, and simplify duplicate coverage.

## Completion checks

- [ ] `rg "create(Query|Mutation|PendingMutation|SuccessMutation|ErrorMutation)Mock"` returns no matches.
- [ ] `rg "Use(Query|Mutation)Result" --glob '*test.ts' --glob '*test.tsx'` returns no test-only result casts or fabricated result objects.
- [ ] `rg "vi\\.mock\\('@/hooks/useBackgroundQueries'" --glob '*test.ts' --glob '*test.tsx'` returns no avoidable hook-module mocks.
- [ ] `npm test` passes.
- [ ] `npm run compile` passes.
- [ ] `npm run lint` and `npm run format:check` pass.
