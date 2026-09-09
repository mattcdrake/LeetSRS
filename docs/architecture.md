# LeetSRS architecture

Popup and content scripts send typed commands to the background, which owns
learning-data writes. Services coordinate domain rules and persistence.

## Boundaries

| Location          | Owns                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `entrypoints/`    | WXT registration, background message runner, popup UI and query hooks                     |
| `content/`        | LeetCode DOM/GraphQL integration; mounting and lifecycle in `bootstrap.tsx`               |
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

## Content UI

`content/ui/` owns React/React Aria presentation and Tailwind styles;
`content/rating-actions.ts` owns problem lookup and background RPC orchestration.
`bootstrap.tsx` mounts controls and toasts with WXT `createShadowRootUi` and
`cssInjectionMode: 'ui'`. Portals stay inside the shadow root, using the top layer
to avoid toolbar clipping. Theme detection follows LeetCode's page classes.

WXT removal unmounts React; context invalidation also disconnects the toolbar
observer and disposes auto-reset, which stays outside React. Components clean up
their subscriptions and timers on unmount.

## Messages and writes

RPC contracts and transport live in `infrastructure/browser/messages.ts`.
Under `entrypoints/background/`, `message-handlers.ts` wires services and registers
listeners synchronously; `message-runner.ts` owns shared types and execution,
without service imports.

Handlers wait for startup. Writes share one queue, including alarm-driven Gist
sync and its network requests. Reads can overlap writes; partial writes remain possible.

Services own clocks, settings reads, and write order; domain calculations receive
explicit inputs.

## Storage, backup, and sync

Cards are slug-keyed, notes reference card UUIDs, and stored card dates are numeric.
Persistence guarantees supported card fields, FSRS schedules, notes, stats, settings,
and Gist configuration. Unrecognized fields may be discarded; unrelated undecodable
records need not survive mutations. Schema changes require a new sequential migration
in `infrastructure/storage/migrations.ts`.

Backup ownership is split deliberately:

- Infrastructure owns card date codecs, stored-record validation, migrations, and
  card/note/stat persistence. Persistence adapters do not mark local edits.
- Domain owns import envelope/configuration validation, settings compatibility, and
  relationship checks without depending on storage types.
- Services prepare imports by migrating and validating before replacement, then
  orchestrate reset/restore through the shared persistence adapters, preserve the
  local PAT, and apply imported timestamps after settings writes.

Imports discard extra record and configuration fields while validating supported
fields and relationships. Legacy imports default missing card domains to
`leetcode.com` and map `autoClearLeetcode` to `resetEditorOnEveryProblem`, with the
current setting taking precedence.

Sync, backup/reset, and local-edit tracking share
`infrastructure/storage/sync-metadata.ts`. Gist sync uses whole-dataset
`dataUpdatedAt` last-write-wins and restores pulls through backup import. Payloads
include settings and Gist configuration, exclude the PAT, and need new synchronized
fields added to `ExportData`. There is no per-card merge.

## Language and translations

Domain owns language policy; infrastructure detects browser preferences and resolves
stored language. `i18n/` owns dictionaries; popup and content UI own presentation. Settings
policy uses the domain language registry without loading dictionaries.

Future changes belong in the [roadmap](plans/roadmap.md). The
[catalog identity contract](regional-problem-identity.md) describes planned
frontend-ID identity, not current storage.
