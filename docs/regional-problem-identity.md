# LeetCode identity and catalog contract

Decisions from [#233](https://github.com/mattcdrake/LeetSRS/issues/233).
Catalog generation belongs to #228, IndexedDB catalog storage to #229,
migration/payload adapters to #231, and application integration to #217.

## Evidence

The exhaustive comparison used only saved GraphQL catalog exports:

| Snapshot | Fetched at (UTC)        | Questions |
| -------- | ----------------------- | --------: |
| `.com`   | 2026-09-06 06:19:46.891 |     4,046 |
| `.cn`    | 2026-09-06 00:22:48.061 |     4,430 |

- All 4,042 shared frontend IDs have identical slugs, English titles, difficulty,
  and premium status. Neither export has duplicate frontend IDs or slugs.
  No shared slug maps to different frontend IDs.
- Frontend IDs 4043–4046 occur only in the `.com` file; 388 frontend IDs occur
  only in the `.cn` file. Different snapshot times may explain the four recent
  entries, but their presence in `.cn` was not established by these exports.
- Topic membership differs for 28 shared records; acceptance rates differ for
  all shared records. These are not identity conflicts.
- Every `.cn` record has a translated title. The `.com` export does not request
  translations, so its null values are not conflicting translations.
- In `.com`, 3,340 frontend IDs differ from internal `questionId` and 706 equal
  it. The `.cn` catalog export omits internal IDs; no corresponding count or
  exhaustive internal-ID comparison can be made from that file.

For example, `1` is `two-sum` in both files. `.cn`-only `LCP 01` is
`guess-numbers`. String IDs preserve regional prefixes and leading zeros.
There is no observed cross-region frontend-ID collision such as `two-sum`
and `three-sum` sharing an ID. This contract accepts the observed frontend-ID
rule and makes future catalog refreshes validate it before publication.

Local inputs and SHA-256 hashes:

- `experiments/leetcode-com-catalog/data/leetcode-com.json`:
  `4e5c15f9dd06b71aeb312af54719c559515dedb0084e3c24a06ad2580385373c`
- `experiments/leetcode-cn-catalog/data/leetcode-cn.json`:
  `296c452398971f7a1c5584558196e3aedb768da25d931d93496a7a2f0e73de9d`

The local offline audit is `experiments/regional-problem-identity/audit.mjs`;
its detailed output is `audit.json` in the same directory. Experiments and full
snapshots are Git-ignored; this document records the evidence in the repository.

## Identity and merged schema

Use the string `frontendId` as the canonical problem, card, note-reference and
schedule ID. Both regional copies resolve directly to that ID. There is no
problem UUID, internal-ID address, composite identity or regional mapping table.
Source is availability/navigation metadata, not part of identity. Keep a card's
source preference where needed; validate it against the catalog's availability.

One merged record per frontend ID contains:

| Field                                       | Rule                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `frontendId`                                | Exact nonempty string; canonical key                                                             |
| `sources`                                   | Available domains: `leetcode.com`, `leetcode.cn`, or both                                        |
| `slug`, `title`, `difficulty`, `isPaidOnly` | Require agreement when both sources contain the ID                                               |
| `translatedTitle`                           | Take `.cn` translation when present; otherwise null                                              |
| `topics`                                    | Take `.com` membership and names when available; otherwise `.cn`                                 |
| Topic `translatedName`                      | Enrich selected topics from `.cn` by topic slug; do not add `.cn`-only topics to a shared record |
| `acceptanceRate`                            | Take `.com` when available; otherwise `.cn`; normalize to a 0–1 fraction                         |

An empty `.com` topic list is still the selected `.com` value. Do not silently
union topic lists. Source availability is retained even when metadata comes from
`.com`. The catalog envelope carries schema/generator versions, content hash and
source provenance; timestamps stay out of per-record content and hashes.

## Source availability and active-page lookup

`sources` is a nonempty, deduplicated, deterministically ordered array of domains,
for example `["leetcode.com", "leetcode.cn"]` or `["leetcode.cn"]`. Derive regional
exclusivity from this array; do not add `comOnly`/`cnOnly` flags. Use it to filter
by region, validate page lookups and avoid generating links to unavailable
regional copies. It never creates separate cards, notes or schedules.

Generate availability from presence in the accepted source snapshots, independently
of metadata precedence. When a question disappears from one source, remove that
source from the array while retaining the record if the other source still has it.
Remove the catalog record only when neither source contains it. Include availability
changes in the generated diff and catalog hash.

The current content script reads a slug from LeetCode's router or URL, then calls
GraphQL for metadata and sends `questionFrontendId` as `leetcodeId`. Current card
storage and mutations are slug-keyed; notes use legacy card UUIDs. Editor reset
additionally matches the card's stored domain.

#217 replaces the runtime metadata request with this flow:

```text
Page hostname + router/URL slug
  -> typed background lookup in the bundled catalog (#229)
  -> matching frontend ID, with source membership checked
  -> frontend-ID card/note/schedule operation
```

Keep page-slug detection. The source/slug lookup is a navigation index, not the
card identity. An unknown or unavailable page cannot create a reference card;
it waits for a catalog release without a remote metadata fallback. Due-review
editor reset resolves the same frontend ID on either regional page instead of
requiring the saved card's domain to match. Keep existing reset settings intact.

#231 prepares the conversion of slug-keyed stored cards to frontend-ID keys and
UUID-keyed notes to frontend-ID keys, including import/export and Gist adapters.
#217 activates it and switches add/rate/remove/delay/pause, note operations,
editor reset and all popup/content-script callers and messages to frontend ID.
Cards, notes and statistics stay in their existing storage backend.

## Refresh and release algorithm

1. Fetch every page of both GraphQL catalogs using pinned `leetcode-query`.
   Validate response shapes, required metadata, rate units, totals, complete
   pagination and duplicate frontend IDs/slugs. Never accept a partial download.
2. Normalize selected fields, sort records and unordered topic lists, and hash
   each source's content without fetch timestamps or response ordering noise.
   Compare with the last accepted source hashes. Exit if both are unchanged and
   the schema/generator version is unchanged. Acceptance rates will often cause
   a real content change even when problem identities are unchanged.
3. If changed, validate all shared frontend IDs against slug, English title,
   difficulty and premium status. Also reject a shared slug with differing
   frontend IDs, and inspect identity changes and suspicious removals relative
   to the last accepted catalogs. One-region-only records are normal. Topic and
   acceptance-rate differences are allowed by the precedence rules above.
4. On invalid data or a collision, fail the job, notify the maintainer, and keep
   the previous accepted catalog and hashes. Do not invent alternate IDs or
   partially publish the successful source. Removal thresholds are an
   implementation parameter for #228, not a decided numeric limit here.
5. On success, generate one deterministic catalog JSON, its version/hash and a
   reviewable additions/changes/removals summary. Advance the accepted baseline
   together with the generated output. Include upstream removals.
6. Run weekly initially, with a manual trigger. The maintainer manually creates
   a new extension build/release to deliver the catalog; no runtime API fetches.
7. At extension initialization, compare the bundled catalog version/hash with
   the installed one. Atomically replace the IndexedDB catalog when changed,
   including removals, and update its version in the same transaction. Gate
   lookups until initialization finishes; recover from interrupted imports and
   retain the previous usable catalog on failure. Learning data is separate.

GitHub Actions supports failure-only email notifications. Enable them for the
scheduled workflow owner; notification ownership can change when its schedule
is edited or the workflow is re-enabled. See
[GitHub's notification documentation](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

## Migration and operation examples

Migration is prepared in #231 and activated in #217 through a new sequential
storage migration. Use the same transformation rules for startup and imports.

- A legacy `.com` `two-sum` card with `leetcodeId: "1"` becomes card `"1"`.
  Preserve `createdAt`, the entire serialized FSRS state (including due and last
  review), pause state and source preference. Move its note from the legacy
  `card.id` UUID to frontend ID `"1"`; do not recompute the schedule.
- A `.cn`-only `guess-numbers` card with `leetcodeId: "LCP 01"` becomes
  `"LCP 01"`, preserving the same learning fields and note.
- If `.com` and `.cn` legacy cards both resolve to `"1"`, choose the `.cn`
  card as a whole, even if the `.com` review is newer. Its creation time, complete
  schedule, note and pause state win together. Do not combine notes or FSRS
  states; if the winning card has no note, do not inherit the losing note.
- Preserve the existing legacy default of `leetcode.com` for a missing domain.
  Resolve the legacy string `leetcodeId` against the installed catalog; use
  source and slug to validate migration inputs, not to create new identities.
- Skip invalid imported records and unresolved catalog references while
  accepting valid ones, as required by #231. Do not carry fallback problem
  metadata in cards, backups or Gist payloads. Catalog removal handling must
  not reset unrelated notes, schedules or statistics.

Catalog lookups and card mutations, ratings, pause/delay/remove operations,
notes, editor reset and scheduling all address frontend ID. Regional URLs use
source availability and the catalog slug. Import/export and Gist synchronize
reference cards and learning data, not rebuildable catalogs or device settings.
An operation on either regional copy must see the same schedule and note.
