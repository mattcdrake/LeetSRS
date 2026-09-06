# Issue #240: extract review calculations without changing timing

One behavior-preserving PR closing #240. Preserve FSRS parameters and singleton
lifetime, every clock/settings read and its position relative to storage, errors,
serialization, eligibility, ordering, daily limits, and requeue behavior. Do not
introduce operation snapshots (#218) or extract persistence (#241).

- [x] 1. Characterize review-day boundaries and repeated clock/settings reads in
  the existing services before extraction. Cover queue filtering across the day
  boundary, paused-card clock behavior, and independent statistics date reads.
  Run full checks and a production build and record the baseline.
- [x] 2. Extract review-day helpers into `domain/review-day.ts`, moving their
  existing calculation tests and updating consumers. Keep implicit clock reads
  at service call sites; domain calculations take explicit reference dates.
  Preserve default behavior where callers currently omit a date. Run checks/build.
- [x] 3. Extract scheduling, delay-date, sorting, and queue calculations into
  domain modules. Preserve the FSRS singleton and maximum interval of 1000.
  Keep per-unpaused-card clock reads during eligibility checks and the later
  statistics read in services; split calculations around those existing reads.
  Move calculation tests and retain orchestration characterizations. Run checks/build.
- [x] 4. Extract statistics accumulation, state counts, and history/upcoming
  bucket calculations with explicit inputs. Keep conditional yesterday reads,
  settings reads, clocks, and storage sequencing in services. Move calculation
  tests, update guidance and architecture checklist, run full checks/build,
  and compare manifest, outputs, and runtime call order with the baseline.

Task 1 results: baseline checks passed (51 test files, 592 tests). Added 11
characterization cases; full checks now pass (52 files, 603 tests). Production
build passes with the existing large-chunk warning; output is byte-identical
to the baseline saved at `/tmp/leetsrs-240-baseline-build`. No production code
changed. Manifest permissions and entrypoints are unchanged. No live-browser
smoke test was performed.

Task 2 results: moved review-day calculations and 16 existing calculation/boundary
cases into `domain/`. The service wrapper preserves the omitted-date clock read,
with an additional regression test. Queue, statistics, and editor-reset clock
locations are unchanged. Full checks passed (53 files, 604 tests); production
build passed. Manifest, content script, and popup output match the baseline;
the generated background bundle differs after extraction.

Task 3 results: extracted scheduling/delay helpers and queue partitioning,
sorting, and daily-limit calculations. FSRS construction and parameters remain
at the original service location; scheduling receives that same instance. The
per-card clock reads and statistics/settings reads retain their order. Moved
three sorting tests to the domain and added limit/nonmutation and calendar-date
cases; retained service rating, delay, eligibility, and timing coverage. Full
checks passed (55 files, 615 tests), and production build passed. Manifest, popup,
and content output match the original baseline; background output differs.

Task 4 results: extracted statistics accumulation, state counts, and historical/
upcoming buckets into `domain/statistics.ts`. Moved two calculation tests and
added accumulation, boundary/bucket, and service read-order cases. All checks
passed (56 files, 622 tests); production build passed with the existing chunk
warning. Manifest, popup, and content output match the original baseline; the
background bundle differs after extraction. Existing rating, storage/export,
queue/requeue, error, and timing tests remain green. Clock/settings reads,
conditional yesterday lookup, writes, FSRS initialization, and message/storage
contracts retain their existing behavior. Updated repository/architecture
guidance. No live-browser smoke test was performed. All four tasks are complete.
