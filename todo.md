# Refactor pass

Immediate implementation:

- [ ] [#266](https://github.com/mattcdrake/LeetSRS/issues/266): consolidate `domain/stats.ts` and `domain/statistics.ts` into `domain/statistics.ts`; preserve public data shapes and behavior.
- [ ] Change `content/bootstrap.ts` to direct sibling imports instead of importing `content/index.ts`.
- [ ] Remove the pass-through `scheduleReview` function; call `fsrs.next` from `services/cards.ts`, preserving FSRS lifetime, parameters, timing, and write order. Keep the meaningful delayed-date calculation in domain.
- [ ] Merge `domain/settings-policy.ts` into `domain/settings.ts`, keeping settings types, constraints, defaults, and validation together.
- [ ] Consolidate eligibility, queue selection, and delayed-date calculation in `domain/review.ts`; move shared calendar bucketing to `domain/calendar.ts`. Preserve current timing and eligibility behavior; keep #126/#218 behavior changes separate.
- [ ] Group card persistence under `infrastructure/storage/cards/` as `store.ts` and `codec.ts`, with nearby tests. Keep the codec independently importable without loading browser storage; coordinate conversion ownership with #220.
- [ ] Group the backup codec and snapshot adapter under `infrastructure/storage/backup/`, with nearby tests. Keep conversion and storage I/O separate, and retain import acceptance policy in domain.
- [ ] Update imports and affected open issues, reconcile grouping decisions in the review/roadmap, and document implemented paths in `architecture.md` as each move completes.
- [ ] Run required checks after implementation and update current-state documentation and affected issue paths.

Planning and tracking:

- [x] Record accepted decisions, issue links, and revised grouping recommendations in `docs/arch-review.md`.
- [x] Update `docs/architecture.md` and `docs/plans/roadmap.md`, distinguishing current code from planned changes.
- [x] Create labeled issues for review suggestions 1–6, renewed Gist setup work, and unfinished #155 cleanup; configure appropriate relationships.
- [x] Update #216 to move renderers under `content/ui/` while establishing lifecycle ownership.
- [x] Reconcile affected open issues with the selected refactors and preserve their existing scope and dependencies.

The `content/ui/` renderer move remains part of #216 rather than this immediate pass.
