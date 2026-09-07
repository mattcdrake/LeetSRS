# Architecture review

Reviewed September 6, 2026, against commit `3922402`, the current
[architecture](architecture.md), the local [roadmap](plans/roadmap.md), and the
repository's open issues and relevant closed issue bodies. This is a design
review. Completion notes below reflect the implemented refactors; the remaining
recommendations retain their issue owners.

The next pass should improve a few module interfaces rather than repeat the
repository-wide relocation. The major correctness work already has owners in the
roadmap. The best additional preparation is to hide queue construction details,
separate background execution from application wiring, and consolidate the note
editor's presentation. Smaller improvements concern statistics ownership, regional
permissions, and rating definitions.

I used John Ousterhout's _A Philosophy of Software Design_ as the design lens:
reduce the knowledge callers need, keep related decisions together, and split
modules when they hide different kinds of complexity. Small functions and extra
layers are not ends in themselves. His [description of the second edition](https://web.stanford.edu/~ouster/cgi-bin/book.php)
emphasizes deeper general-purpose modules and deciding what matters; the specific
recommendations here are my application of those principles to this repository.

## Decisions after review

The minor refactors under [#271](https://github.com/mattcdrake/LeetSRS/issues/271)
are implemented: barrel and passthrough audits (#272/#279), direct FSRS calls
(#273), settings consolidation (#274), review/calendar organization (#275), and
card/backup storage grouping (#276/#277). References are reconciled in #278.
Each implementation passed the repository checks.

Statistics consolidation (#266) is also implemented. Queue API encapsulation
remains #264; the review/calendar move preserved the existing two-step API.

All six recommendations now have issues. Gist setup work is explicitly renewed
in #269 despite #152 having been closed as not planned. Unfinished #155 work is
tracked in #270; Gist setup feedback belongs to #269, while #270 owns Data settings
feedback, routine logging, icon extraction, and safe independent reads.

| Recommendation | Tracking |
| --- | --- |
| 1. Background executor | [#263](https://github.com/mattcdrake/LeetSRS/issues/263) |
| 2. Queue construction | [#264](https://github.com/mattcdrake/LeetSRS/issues/264) |
| 3. Note editor | [#265](https://github.com/mattcdrake/LeetSRS/issues/265) |
| 4. Statistics consolidation | [#266](https://github.com/mattcdrake/LeetSRS/issues/266) |
| 5. Regional permissions | [#267](https://github.com/mattcdrake/LeetSRS/issues/267) |
| 6. Rating vocabulary | [#268](https://github.com/mattcdrake/LeetSRS/issues/268) |
| Gist setup controller | [#269](https://github.com/mattcdrake/LeetSRS/issues/269) |
| Remaining #155 cleanup | [#270](https://github.com/mattcdrake/LeetSRS/issues/270) |

Native dependencies establish the selected implementation sequence: #213 follows
#263, #218 follows #264 as well as #213, and #221 follows #265. Other references
are coordination links, not additional blockers. Catalog generation stays independent.
#216 now includes moving renderers and presentation helpers under `content/ui/`
while keeping session orchestration and the asynchronous coordinator outside it.

The grouping recommendations below revise the original blanket preference for a
flat domain directory. The selected changes in #274–#277 are implemented.

## Recommended preparation

| Order | Change                                              | Value and timing                                                                   |
| ----- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1     | Separate background executor from concrete registry | Makes #213/#215/#219 easier to implement and test independently of service wiring. |
| 2     | Hide queue partitioning inside queue construction   | Removes a caller sequencing requirement before queue/filter features.              |
| 3     | Consolidate note-editor presentation                | Gives #221/#248 one place to implement controls and feedback.                      |
| 5     | Own regional permissions in one popup module        | Gives catalog-related UI one consistent permission capability.                     |
| 6     | Consolidate rating definitions                      | Prevents rating semantics and presentation from drifting across surfaces.          |

These are bounded changes, not new hard blockers for catalog generation.
Items 1–3 prepare subsequent issues; statistics consolidation is complete.
Items 5–6 remain separately tracked. None requires changing
storage or message formats.

### 1. Separate background execution from application wiring

[Background messaging](../entrypoints/background/messaging.ts) contains three
different responsibilities: the concrete service registry, the promise-queue
executor, and transport registration. Its executor already takes injected
readiness and side-effect functions, but importing it also imports every service
referenced by the registry. The
[executor tests](../entrypoints/background/__tests__/messaging.test.ts) use synthetic
handlers yet import that complete application dependency graph.

Split `createBackgroundMessageExecutor` and its options into
`entrypoints/background/executor.ts`. Keep the concrete `messages` registry and
registration in `messaging.ts`; retain `registry-types.ts` beside them. Tests of
queue behavior can then import the executor without loading FSRS, Gist workflows,
or persistence adapters. Registration and the real registry should still have
integration coverage.

This split follows independent reasons to change: adding a catalog RPC changes
wiring; altering execution changes readiness, ordering, and failure behavior.
Neither operation should require understanding the other implementation. Keep one
exhaustively typed registry; splitting it into many tiny per-command files would
add navigation without hiding useful complexity.

The extraction itself must preserve synchronous listener registration, one shared
write queue, reads bypassing that queue, and current side-effect order. Run the
existing executor behavior tests against the new import. The executor should have
no runtime imports from services or the concrete registry.

**Issue distinction:** [#246](https://github.com/mattcdrake/LeetSRS/issues/246)
moved registry policy types, not the executor implementation. This recommendation
does not implement recoverable commits, remove network work from the queue, or
change badge failure behavior; those remain #213, #215, and #163.

### 2. Make queue construction one operation

[The queue domain module](../domain/review.ts) exports
`partitionDueCards` and `buildReviewQueue`. The latter accepts separate review and
new-card arrays and relies on the former to sort new cards before the daily-limit
slice. A caller can pass an unsorted array and select the wrong new cards even
though the final result is sorted correctly.

[The card service](../services/cards.ts) must know this assembly sequence. Even
the [domain tests](../domain/__tests__/review.test.ts) define a `queueFor`
helper to reconstruct it. That helper is a useful signal that the public operation
is missing.

Expose one operation along these lines:

```ts
buildReviewQueue(dueCards, { maxNewCardsPerDay, newCardsCompletedToday });
```

Keep partitioning, ordering new candidates, applying the allowance, and final
ordering private to that operation. Use readonly inputs and preserve the existing
ordering and lack of input mutation. The service should acquire data and pass
already eligible cards plus the allowance inputs.

Keep eligibility filtering outside this particular refactor: the current service
samples time per card, and moving that into a single snapshot would silently do
part of #218. Likewise, do not reuse the limited queue as the definition of
“Due” for the future card-list filter; eligible cards and cards selected under the
daily new-card allowance are different concepts.

Acceptance is straightforward: callers supply one unsorted candidate collection,
and the module correctly selects the earliest new cards, retains due non-new
cards, honors exhausted allowances, and leaves inputs unchanged. Existing queue
tests already cover most of that behavior.

**Issue distinction:** [#240](https://github.com/mattcdrake/LeetSRS/issues/240)
completed extraction of the calculations. This is a smaller follow-up to improve
the extracted interface. #218 owns snapshot acquisition; #126 owns exact-time
eligibility; #124/#132 own the new UI behaviors.

### 3. Share the complete note-editing control

[NotesSection](../entrypoints/popup/views/home/NotesSection.tsx) and
[CardNotes](../entrypoints/popup/views/card/components/CardNotes.tsx) already share
`useNoteEditor`, but both unpack almost its entire interface and reconstruct the
same text field, character count, pending states, save button, and two-step delete
button. The hook centralizes workflow state while leaving every consumer to
understand how that state controls the UI. Error handling has already diverged:
the home wrapper reads and logs the hook's error, while the card-list wrapper
does not read it.

Introduce a popup-owned `components/notes/` module containing a shared editor
component and the existing hook. Keep the home accordion in `NotesSection` and the
card-list border/title in `CardNotes`. The editor should own its field, controls,
counter, and feedback presentation, with a small explicit compact/regular layout
choice for the existing size differences. Move textarea autosizing with the
compact editor presentation.

Aim for a public interface based on the card ID and layout, not a component that
requires callers to pass fifteen hook fields or callbacks. Avoid configurable
slots for each button when neither consumer needs that flexibility.

Preserve mounting semantics deliberately: today the home hook remains mounted
when its accordion collapses. Moving the hook into conditionally mounted content
would discard its local state. The shared editor must remain mounted while hidden,
or its owner must retain the editor state. Card-switch and draft policies should
continue to be settled by #221.

Verify both wrappers retain their layout and expansion behavior, and exercise
save/delete/count behavior through the shared control. This reduces the number
of surfaces that must change together when feedback is added.

**Issue distinction:** [#221](https://github.com/mattcdrake/LeetSRS/issues/221)
owns draft transitions and mutation failures; #248 owns translated errors. Sharing
the repeated editor presentation is additional structural work. It can be a
preparatory extraction or an explicitly scoped part of those implementations,
without creating a competing draft-state solution.

### 4. Give statistics one domain owner

Implemented locally: types and calculations now share `domain/statistics.ts`, with
one `BaseStats` definition. Consumers use the consolidated module; storage and
service responsibilities remain separate. The original rationale follows.

`domain/stats.ts` previously defined `DailyStats`, `UpcomingReviewStats`,
and a private `BaseStats`. [domain/statistics.ts](../domain/statistics.ts) duplicated
that base shape alongside construction and projection calculations. The two nearly
synonymous files separated a modest model from the operations that explain it.

Merge the domain types into `domain/statistics.ts` and keep one internal base
shape. Update consumers to use type-only imports where appropriate. This keeps
record definitions, initialization, and updates together; adding a measure should
not require discovering a second copy of its base structure.

Keep `services/stats.ts` and `infrastructure/storage/stats.ts` separate: orchestration
and serialization/storage have different dependencies and responsibilities. Domain
types do not need their own file merely because messaging imports them as types.

Do not simultaneously turn statistics into an event-sourced system or expose a
generic analytics framework. Existing daily records and projections are sufficient
for this consolidation. Preserve their exact shape, counters, streaks, and date
behavior, using the existing domain and import/export tests for verification.

**Issue distinction:** #134 adds topic statistics and #126 changes calendar policy;
neither calls for resolving this duplicate domain definition. Historical review
events remain outside the roadmap.

### 5. Centralize the regional permission capability

[LeetcodeCnBanner](../entrypoints/popup/components/LeetcodeCnBanner.tsx) and
[LeetcodeCnSection](../entrypoints/popup/views/settings/LeetcodeCnSection.tsx)
independently define the same origin pattern, query permission, request it, and
manage local state. The banner additionally owns active-tab lookup and a raw
`localStorage` dismissal key. Both views must know the mechanics of enabling
regional access.

Create a popup-owned `capabilities/leetcode-cn.ts` module with a hook or small
controller exposing permission state and an enable action. It should own the
permission pattern, permission reads, and observation of permission changes.
Keep active-tab relevance and banner dismissal separate from the permission's
truth: dismissing a banner does not grant access.

The request must remain initiated directly by the popup's user interaction; do
not route it through a background command merely to make all browser calls look
alike. Keep the dismissal key with popup-local preferences and document its
intentionally local lifetime. The manifest declaration remains build-time
configuration, so no runtime import of `wxt.config.ts` is warranted.

This is an ownership clarification, not evidence of a service/persistence import
violation. The architecture already permits UI code to own UI behavior, but should
explicitly distinguish local browser capabilities and disposable UI preferences
from learning-data workflows. A single module makes that distinction reviewable.

Verify denial leaves access disabled, granting access updates both consumers,
external permission changes are reflected, and banner dismissal does not alter
permission. Preserve the current active-tab condition.

**Issue distinction:** [#157](https://github.com/mattcdrake/LeetSRS/issues/157)
implemented the banner's regional visibility rule. #217 concerns catalog source
availability and navigation. Neither owns consolidating browser permission state;
catalog availability and browser authorization must remain separate concepts.

### 6. Own rating definitions once; keep rendering local

[content/constants.ts](../content/constants.ts) maps raw numbers 1–4 to rating
names, [ReviewCard](../entrypoints/popup/views/home/ReviewCard.tsx) repeats the
mapping with FSRS enum members, and
[ReviewHistoryChart](../entrypoints/popup/views/stats/ReviewHistoryChart.tsx)
manually enumerates the same grades again. The content callback accepts `number`,
requiring `bootstrap.ts` to assert it is a `Grade`.

There is also concrete presentation drift: review buttons use blue for Good and
green for Easy, while the history chart uses green for Good and blue for Easy.

Define an ordered, typed rating vocabulary in `domain/ratings.ts`, using FSRS
enum members and stable semantic keys such as `again` and `good`. Both UIs can
map those keys into their own translations and styles. Type the content callback
as `Grade` end to end and remove the cast at the workflow boundary. Keep
translation dictionaries, DOM logic, CSS classes, and chart options out of domain.

Within the popup, give rating colors one presentation owner used by buttons and
the history chart. Treat aligning the existing chart colors as an explicit visual
change, with screenshots. Sharing the vocabulary does not require replacing React
and DOM renderers with a common widget system or unifying the entire theme system.

Verify the four controls still send the intended grades in the intended order,
and chart dataset labels, values, and colors refer to the same grade. This is useful
before #123 adds another rating-prompt trigger and #134 adds statistics surfaces.

**Issue distinction:** #161 concerns localized dimensions and #248 concerns error
translation. Neither owns rating vocabulary or semantic color consistency.

## Placement decisions and limits

The inspected runtime and type imports follow the principal domain/service/storage
direction. I did not find grounds for another layer hierarchy or a wholesale move
from technical layers to vertical features. The specific ownership exceptions and
improvements above are more useful than a broad claim that the new architecture
is violated.

- Choose file boundaries by independent responsibility and directory boundaries by
  cohesive ownership. Flatness is not an architectural invariant; the more specific
  grouping recommendations below supersede the original flat-directory advice.
- Keep popup queries together. Their shared cache dependencies make that a useful
  owner, and #219 already owns improving those dependencies.
- Add popup subdirectories when they expose a coherent capability, as with notes
  and permissions. Avoid a new catch-all `shared/` or `utils/` directory.
- Content bootstrap uses direct sibling imports; the unused content barrel was
  removed. Moving renderers under `content/ui/` remains #216, together with
  lifecycle ownership. Preserve the coordinator/renderer separation from #165.
- The card service calls `fsrs.next` directly and retains FSRS lifetime, parameters,
  timing, and write order. Delayed-date calculation lives in `domain/review.ts`;
  snapshot changes remain #218.
- Retained abstractions have specific responsibilities: the translation catalog
  owns dictionaries and their shared type; card/note service exports expose their
  operations; storage adapters own keys and raw records; query hooks own caching;
  the GitHub client shapes requests and retains authentication per operation.
  The service due-date helper supplies a clock default, and content coordinators
  own asynchronous interaction state. The audits removed convenience forwarding,
  including a test-only statistics re-export, without flattening these boundaries.
- Leave the backup codec, import policy, and snapshot storage separate. Their
  apparently similar types reflect genuinely different trust and persistence
  boundaries. #214/#215/#231 should deepen these contracts without undoing the
  deliberate split documented in the architecture.
- Keep dependency enforcement in review as currently agreed. Lack of an automated
  boundary checker is not a newly discovered violation or a reason to delay features.

## Which files should merge or form a directory?

A directory helps readers find related implementation, but does not by itself hide
anything from callers. Merge small files that express one concept; retain separate
files when each can hide a useful, independently consumed responsibility. A shared
prefix or frequent imports alone does not settle that choice.

**Review:** `domain/review.ts` now owns eligibility, queue selection, and
delayed-date calculation. Eligibility remains independently callable. Shared
calendar bucketing lives in `domain/calendar.ts`, so statistics and streaks do
not depend on queue construction. #264 will encapsulate the existing queue
assembly sequence; #218 and #126 own snapshot and exact-time behavior changes.

**Settings:** `domain/settings.ts` now owns types, constraints, defaults, registry,
and validation. Browser language resolution stays in services/adapters and
translation dictionaries stay in `i18n/`. Type-only consumers import only types.

**Stored cards:** `infrastructure/storage/cards/` contains `store.ts`, `codec.ts`,
and nearby tests. The store retains loaded records for writes; the codec remains
independently importable without WXT storage. #220 owns the shared storage/message
JSON representation and any further conversion-boundary changes.

**Backup:** `infrastructure/storage/backup/` contains `codec.ts`, `snapshot.ts`,
and nearby tests. Conversion and storage I/O remain separate. Import acceptance
stays in domain; reset/restore order, PAT preservation, and imported timestamps
stay in services. #214/#215/#231 own the subsequent behavior changes.

Statistics types and calculations share `domain/statistics.ts`. Keep
`domain/notes.ts` as a model-and-validation module and background registry types
beside the executor. Shared nouns do not justify merging services with storage.

## Existing work deliberately excluded

| Concern found during review                                                      | Existing owner                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Partial card/stat/note writes, mixed reads, badge errors after persistence       | [#213](https://github.com/mattcdrake/LeetSRS/issues/213), #218, #163 |
| Weak import validation, startup continuing after migration failure               | [#214](https://github.com/mattcdrake/LeetSRS/issues/214)             |
| Date-bearing messages and unrealistic message mocks                              | [#220](https://github.com/mattcdrake/LeetSRS/issues/220)             |
| Destructive sync restore, timestamp conflicts, network occupying the write queue | [#215](https://github.com/mattcdrake/LeetSRS/issues/215), #249       |
| Manual cache invalidation and stale cross-context views                          | [#219](https://github.com/mattcdrake/LeetSRS/issues/219)             |
| Content navigation, cancellation, observers, and pending UI cleanup              | [#216](https://github.com/mattcdrake/LeetSRS/issues/216)             |
| Slug/UUID identity leakage, full-card lookup, metadata repeated in rating inputs | [#217](https://github.com/mattcdrake/LeetSRS/issues/217), #229, #231 |
| Draft loss and missing mutation feedback                                         | [#221](https://github.com/mattcdrake/LeetSRS/issues/221), #248       |
| Calendar/date helpers and exact due-time policy                                  | [#126](https://github.com/mattcdrake/LeetSRS/issues/126)             |
| Catalog prototype consolidation and production generator placement               | [#228](https://github.com/mattcdrake/LeetSRS/issues/228)             |

Closed issues also matter. The large `GistSyncSection` would benefit from extracting
setup state, but [#152](https://github.com/mattcdrake/LeetSRS/issues/152) already
describes that work and is closed as **not planned**. The user has now renewed it
in #269. Likewise, logging, alerts,
the inline empty-queue icon, and concurrent independent storage reads already
appear in [#155](https://github.com/mattcdrake/LeetSRS/issues/155), marked completed,
even though examples remain in the current code. The user selected a new follow-up,
#270, for those remaining tasks, with Gist setup feedback assigned to #269.

The refactor pass should finish when these selected interfaces require less caller
knowledge and existing behavior remains intact. New repositories, generic command
buses, provider frameworks, learning-data IndexedDB migration, and event history
would expand the project beyond the foundation work justified here.
