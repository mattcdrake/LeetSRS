# Plan: encapsulate review queue construction

Issue: [#264](https://github.com/mattcdrake/LeetSRS/issues/264)

## Scope

Make `domain/review.ts` own queue construction from one readonly collection of
already eligible cards. Preserve current behavior and architecture boundaries.
This prepares the API for #218; consistent snapshots, exact-time eligibility
(#126), and full-queue/filter features (#124/#132) remain separate work.

## Tasks

- [x] Read the issue, `docs/plans/roadmap.md`, architecture, callers, and relevant tests.
- [x] Change `buildReviewQueue` to accept `eligibleCards: readonly Card[]`,
      `maxNewCardsPerDay: number`, and `newCardsCompletedToday: number`, returning `Card[]`.
      Keep the existing allowance arguments to minimize the API change.
- [x] Make partitioning private in `domain/review.ts`. Internally separate New
      from other FSRS states, sort new candidates by due timestamp then slug, select
      up to `Math.max(0, maxNewCardsPerDay - newCardsCompletedToday)`, and sort the
      combined result using the same comparator. Preserve all eligible Learning,
      Review, and Relearning cards. Do not mutate the input collection or cards.
- [x] Update `services/cards.ts` to pass its eligible collection directly and
      remove the `partitionDueCards` import/call. Preserve paused-card filtering,
      independently callable `isDueByDate`, and existing clock/settings/statistics
      reads, including per-card clock sampling and missing-statistics fallback.
- [ ] Update `domain/__tests__/review.test.ts` to exercise the public builder
      directly without caller-side partitioning. Reuse existing card helpers and
      retain ordering, millisecond precision, quota, and immutability coverage.
      Cover unsorted mixed states with more new candidates than allowance, slug
      ties at the selection cutoff, interleaved new/review final ordering, empty
      input, zero/exhausted/exceeded allowance, and a readonly/frozen input array.
- [ ] Verify service coverage in `services/__tests__/cards.test.ts` and
      `services/__tests__/review-timing.test.ts` still protects eligibility,
      paused-card exclusion, daily limits, and read timing; add only missing
      behavioral regression coverage.
- [ ] Run the focused domain/card-service/review-timing tests, then
      `npm run check` with Node.js 24+. Resolve failures caused by this change.
- [ ] Check that partitioning is no longer exported or assembled by callers.
      Review the diff for unintended policy changes. Once implementation is
      complete, remove the completed #264 task and its blocker reference from
      `docs/plans/roadmap.md`, preserving #218's remaining dependency on #213.
      Check off completed tasks here and leave changes uncommitted.

## Clarifications

None needed for the current scope: the issue specifies the behavior and API
boundary. Ask before expanding scope or changing existing review policy.
