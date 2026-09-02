# TODO: Split background React Query hooks by domain

Issue: [#150](https://github.com/mattcdrake/LeetSRS/issues/150)

## Design

- Replace `hooks/useBackgroundQueries.ts` with domain-focused modules:
  - `hooks/queries/cards.ts`
  - `hooks/queries/notes.ts`
  - `hooks/queries/stats.ts`
  - `hooks/queries/settings.ts`
  - `hooks/queries/data.ts`
  - `hooks/queries/gist-sync.ts`
- Colocate and export query keys with their domain hooks, such as `cardQueryKeys` and `statsQueryKeys`.
- Import hooks and keys directly from their domain modules instead of retaining a compatibility barrel.
- Avoid a generic mutation/invalidation abstraction. Keep invalidation policies visible in each mutation; only introduce a small domain-local helper if it clearly improves readability.

## Invalidation improvements

- Add/remove card: invalidate card queries, card-state stats, and upcoming-review stats.
- Delay/pause card: invalidate card queries and upcoming-review stats.
- Rate card: invalidate card queries and all stats.
- Update settings:
  - Always invalidate settings.
  - Invalidate the review queue when `maxNewCardsPerDay` changes.
  - Invalidate the review queue and date-based stats when `dayStartHour` changes.
  - Do not invalidate cards or stats for appearance, language, badge, or editor-reset settings.
- Import/reset/successful Gist sync: retain full invalidation.
- Add parent keys for parameterized stats queries so all upcoming or historical variants can be invalidated precisely without changing their effective key hierarchy.

## Implementation

- [x] Create the six domain modules and move the existing hooks without losing inferred request or response types.
- [x] Move query keys into their corresponding domain modules.
- [x] Update application and test imports to reference domain modules directly.
- [x] Apply the narrower invalidation policies above.
- [ ] Split `hooks/__tests__/useBackgroundQueries.test.tsx` into domain-focused tests.
- [ ] Add explicit coverage for each mutation's invalidation policy.
- [x] Delete `hooks/useBackgroundQueries.ts`.
- [ ] Run `npm test`.
- [ ] Run `npm run compile`.
- [ ] Run formatting and lint checks.
