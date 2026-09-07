# LeetSRS architecture

Popup and content scripts send typed commands to the background, which owns
learning-data writes. Services coordinate domain rules and persistence.

## Boundaries

| Location          | Owns                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `entrypoints/`    | WXT registration, background executor, popup UI and query hooks                           |
| `content/`        | LeetCode DOM/GraphQL integration; mounting and lifecycle in `bootstrap.ts`                |
| `domain/`         | Models (including sync), scheduling, review days, settings, language and import policy    |
| `services/`       | Workflows, clock/settings reads, FSRS lifetime, write order, sync decisions               |
| `infrastructure/` | Storage keys/codecs/migrations, GitHub requests, browser messaging and language detection |
| `i18n/`           | Translation catalogs and the `Translations` type                                          |

Dependency rules apply to runtime and type-only imports:

- Domain code takes explicit inputs; no browser, storage, service, messaging,
  or translation-catalog dependencies. `ts-fsrs` is allowed.
- Services may compose domain rules, adapters, and other services without cycles.
  Statistics and editor reset read cards through persistence, not the card service.
- Infrastructure must not depend on services or UI. The translation catalog may
  import the domain language type, but has no browser, storage, service, or UI
  dependencies.
- Popup/content workflows use `infrastructure/browser/messages.ts`, not service
  or persistence imports.
  Content's read-only `infrastructure/storage/translations.ts` adapter is the
  exception.
- The popup owns permissions, active-tab inspection, and banner dismissal state.
  Permission requests originate from user interactions.

[Code review](../.github/code-review-guidelines.md) enforces these boundaries;
there is no automated boundary check.

## Messages and writes

Define RPCs and their transport in `infrastructure/browser/messages.ts` and register
handlers in `entrypoints/background/messaging.ts`. Each write declares `refreshBadge`
and `syncTrackingOwner`: the executor marks local edits, the handler manages its
own timestamp, or `none` skips tracking.

Handlers wait for startup. Writes share a queue, including alarm-driven Gist sync
and its network requests. Reads can overlap writes. Serialization is not atomicity:
partial writes remain possible.

Services own clocks, settings reads, and write order; domain calculations receive
explicit inputs.

## Storage, backup, and sync

Cards are slug-keyed, notes reference card UUIDs, and stored card dates are numeric.
Card mutations preserve unrelated legacy fields. Schema changes require a new sequential
migration in `infrastructure/storage/migrations.ts`.

Backup ownership is split deliberately:

- Infrastructure owns payload conversion and snapshot persistence; snapshot helpers
  do not mark local edits.
- Domain owns import acceptance policy without depending on storage types.
- Services orchestrate reset/restore, preserve the PAT, and apply imported timestamps.

Sync, backup/reset, and local-edit tracking share
`infrastructure/storage/sync-metadata.ts`. Gist sync uses whole-dataset
`dataUpdatedAt` last-write-wins and restores pulls through backup import. Payloads
include settings and Gist configuration, exclude the PAT, and need new synchronized
fields added to `ExportData`. There is no per-card merge.

## Language and translations

Domain owns language policy; infrastructure detects browser preferences and resolves
stored language. `i18n/` owns dictionaries, and the popup owns presentation. Settings
policy uses the domain language registry without loading dictionaries.

Future changes belong in the [roadmap](plans/roadmap.md). The
[catalog identity contract](regional-problem-identity.md) describes planned
frontend-ID identity, not current storage.
