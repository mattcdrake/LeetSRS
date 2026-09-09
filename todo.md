# Align card dates with JSON messaging

Issue: [#220](https://github.com/mattcdrake/LeetSRS/issues/220)

Use the existing numeric persisted dates as the single application representation. Preserve scheduling behavior and backup compatibility; no schema bump or new migration is needed.

Accepted scope: scheduling equivalence excludes `last_review: 0`, an unrealistic review date that ts-fsrs treats as absent. No workaround is planned for that library edge case.

## Tasks

- [x] Define the shared `Card` in `domain/cards.ts` with numeric epoch-millisecond `createdAt`, `fsrs.due`, and optional `fsrs.last_review`, retaining required `domain`. Update `services/cards.ts` to pass numeric dates directly to FSRS and normalize FSRS output beside creation and scheduling. Update `domain/review.ts` sorting and delay calculations, keeping local calendar-day behavior. Convert `test/utils/card-mocks.ts` and affected fixtures; extend existing domain and service tests for scheduling, delay, and stable queue ordering with numeric dates.
- [x] Remove `StoredCard` and whole-card conversions from `infrastructure/storage/cards/codec.ts`; use the shared card type in `infrastructure/storage/cards.ts`, `infrastructure/storage/backup.ts`, and `services/import-export.ts`. Rely on startup/import migrations for missing legacy domains; keep `domain` required in storage reads and preserve validation before replacement. Delete obsolete codec tests and replace Date-instance assertions in storage tests with numeric persistence coverage, retaining epoch zero, absent `last_review`, legacy imports, supported-field preservation, and startup-failure coverage in the existing migration and import suites.
- [ ] Remove defensive card/FSRS copies from `infrastructure/storage/cards.ts` reads and writes. Make the test storage setup reproduce browser storage snapshot semantics on both reads and writes; inspect `test/setup.ts` and existing `test/utils/` helpers before adding shared support. Extend storage tests to verify that mutating an input after saving or a retrieved card before saving does not change persisted data, and retain service mutation regression coverage.
- [ ] Carry the shared type through `infrastructure/browser/messages.ts`, `entrypoints/popup/queries/cards.ts`, and their consumers. Update `entrypoints/popup/views/card/components/CardListItem.tsx` to format numeric dates locally and test `last_review` for absence explicitly so zero displays correctly. Extend its existing tests for zero and missing review dates; update affected popup fixtures without introducing a revived client card model.
- [ ] Make `test/utils/message-mocks.ts` JSON-round-trip request data and resolved response data while preserving payload-free calls, void results, and rejected handlers; extend its existing helper tests. Extend `entrypoints/popup/queries/__tests__/cards.test.tsx` with focused coverage connecting actual background card handlers/services through this transport mock to query consumers. Verify read and mutation responses retain numeric dates, including zero and absent `last_review`, and remain usable for queue calculations and subsequent scheduling; reuse existing test wrappers and meaningful scheduling coverage.
- [ ] Manually verify the production Chrome extension with existing numeric data and capture screenshots of expanded card dates.
  - [ ] Load the build in a test profile with existing cards; open the popup and confirm the review queue, card list, and upcoming reviews load without date errors.
  - [ ] Add and rate a problem, delay a review, then reopen the popup; confirm updated dates, queue ordering, and review-day eligibility match existing behavior.
  - [ ] Import a numeric legacy backup missing card domains, including separate cards with zero and absent `last_review`; confirm successful loading, default `.com` links, a displayed epoch date for zero, and no Last row for an absent date. Capture screenshots.
  - [ ] Export and reimport the data in the test profile; confirm card dates remain numeric and cards, schedules, notes, and settings survive the round trip.

## Acceptance criteria

- Storage, services, message contracts, and UI share one numeric-date application `Card` with required domain; JSON transport preserves supported dates and optional-field semantics.
- Scheduling, calendar-day delays, daily limits, queue ordering, and review-day eligibility remain unchanged. Epoch zero remains preserved in storage and transport; scheduling equivalence excludes a zero `last_review`.
- Existing numeric backups and legacy missing-domain data remain compatible. Import validation and startup guarantees remain intact; schema version and sync metadata timestamp formats are unchanged.
- Obsolete models, whole-card codecs, and Date-instance assertions are removed. No ISO migration, date-reviving client, generic production serializer, catalog changes, or exact due-time eligibility changes are introduced.
- Regression coverage and `npm run check` pass; manual scenarios above pass. The implementation handoff reports production and test lines added/deleted separately.
