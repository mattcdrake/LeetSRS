# Issue #240: extract review calculations without changing timing

One behavior-preserving PR closing #240. Preserve FSRS parameters and singleton
lifetime, every clock/settings read and its position relative to storage, errors,
serialization, eligibility, ordering, daily limits, and requeue behavior. Do not
introduce operation snapshots (#218) or extract persistence (#241).

- [x] 1. Characterize review-day boundaries and repeated clock/settings reads in
  the existing services before extraction. Cover queue filtering across the day
  boundary, paused-card clock behavior, and independent statistics date reads.
  Run full checks and a production build and record the baseline.
- [ ] 2. Extract review-day helpers into `domain/review-day.ts`, moving their
  existing calculation tests and updating consumers. Keep implicit clock reads
  at service call sites; domain calculations take explicit reference dates.
  Preserve default behavior where callers currently omit a date. Run checks/build.
- [ ] 3. Extract scheduling, delay-date, sorting, and queue calculations into
  domain modules. Preserve the FSRS singleton and maximum interval of 1000.
  Keep per-unpaused-card clock reads during eligibility checks and the later
  statistics read in services; split calculations around those existing reads.
  Move calculation tests and retain orchestration characterizations. Run checks/build.
- [ ] 4. Extract statistics accumulation, state counts, and history/upcoming
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
