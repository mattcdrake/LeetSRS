# LeetSRS architecture

Popup and content scripts send typed commands to the background, which owns
learning-data writes. Services coordinate domain rules and persistence.

## Boundaries

| Location          | Owns                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `entrypoints/`    | WXT registration, background executor, popup UI and query hooks             |
| `content/`        | LeetCode DOM/GraphQL integration; mounting and lifecycle in `bootstrap.ts`  |
| `domain/`         | Models, scheduling, review-day calculations, settings and import policy     |
| `services/`       | Workflows, clock/settings reads, FSRS lifetime, write order, sync decisions |
| `infrastructure/` | Storage keys/codecs/migrations, GitHub requests, browser-language detection |
| `shared/`         | Public messages, sync contracts, translations                               |

Dependency rules apply to runtime and type-only imports:

- Domain code takes explicit inputs; no browser, storage, service, or messaging
  dependencies. Portable translation dictionaries and `ts-fsrs` are allowed.
- Services may compose domain rules, adapters, and other services without cycles.
  Statistics and editor reset read cards through persistence, not the card service.
- Infrastructure and shared code must not depend on services or UI. Shared code
  must not depend on concrete infrastructure.
- Popup/content workflows use messages, not service or persistence imports.
  Content's read-only `infrastructure/storage/translations.ts` adapter is the
  exception; it resolves stored language with lazy browser fallback.

[Code review](../.github/code-review-guidelines.md) enforces these boundaries;
there is no automated boundary check.

## Messages and writes

Define RPCs in `shared/messages.ts` and register handlers in
`entrypoints/background/messaging.ts`. Background-only policy types live in
`entrypoints/background/registry-types.ts`. Each write declares `refreshBadge`
and `syncTrackingOwner`: the executor marks local edits, the handler manages its
own timestamp, or `none` skips tracking.

Handlers wait for startup. Writes share a queue, including alarm-driven Gist sync
and its network requests. Reads can overlap writes. Serialization is not atomicity:
partial writes remain possible, and badge failure can reject a persisted mutation.

Services own operation timing and write order; domain calculations receive their
inputs. The timestamp helper in `infrastructure/storage/data-tracker.ts` samples
its own clock. Review eligibility uses `domain/review-day.ts` with explicit dates
and `dayStartHour`, not exact due timestamps.

## Storage, backup, and sync

Cards are slug-keyed, notes reference card UUIDs, and stored card dates are numeric.
`infrastructure/storage/cards.ts` retains loaded records and decodes only requested
cards, preserving unrelated legacy fields. Schema changes require a new sequential
migration in `infrastructure/storage/migrations.ts`.

Backup ownership is split deliberately:

- `infrastructure/storage/backup-codec.ts`: payload types and JSON conversion.
- `domain/backup-import.ts`: acceptance, validation, and legacy settings policy;
  record contents pass through without importing storage types.
- `infrastructure/storage/snapshot.ts`: raw records and note traversal.
- `services/import-export.ts`: reset/restore order, PAT preservation, and imported
  timestamps. Snapshot helpers do not mark local edits.

Sync, backup/reset, and local-edit tracking share
`infrastructure/storage/sync-metadata.ts`. Gist sync uses whole-dataset
`dataUpdatedAt` last-write-wins and restores pulls through backup import. Payloads
include settings and Gist configuration, exclude the PAT, and need new synchronized
fields added to `ExportData`. There is no per-card merge.

Future changes belong in the [roadmap](plans/roadmap.md). The
[catalog identity contract](regional-problem-identity.md) describes planned
frontend-ID identity, not current storage.
