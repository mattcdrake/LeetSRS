# Architecture reference

Current ownership and implementation constraints. Keep this reference aligned with authorized design changes; historical decisions live in ADRs.

## Ownership and dependencies

These rules apply to runtime and type-only imports:

- `entrypoints/` owns WXT registration, background message execution, popup UI, and query hooks.
- `content/` owns LeetCode DOM/GraphQL integration. `content/ui/` owns presentation; `content/rating-actions.ts` owns problem lookup and background RPC orchestration; `content/bootstrap.tsx` owns mounting and lifecycle.
- `domain/` owns models, scheduling, review days, settings, language, and import policy. Pass explicit inputs; keep browser, storage, service, messaging, and translation-catalog dependencies out. `ts-fsrs` is allowed.
- `services/` owns workflows, clocks, settings reads, FSRS lifetime, write order, and sync decisions. Services may compose domain rules, adapters, and other services without cycles. Statistics and editor reset read cards through persistence rather than the card service.
- `infrastructure/` owns storage keys, codecs, migrations, GitHub requests, browser messaging, and language detection. It must not depend on services or UI.
- `i18n/` owns translation catalogs and the `Translations` type. It may import the domain language type, but has no browser, storage, service, or UI dependencies. Settings policy uses the domain language registry without loading dictionaries.
- Popup and content workflows use `infrastructure/browser/messages.ts` rather than importing services or persistence. Content may use the read-only `infrastructure/storage/translations.ts` adapter.
- The popup owns permissions, active-tab inspection, and banner dismissal state. Permission requests originate from user interactions.

## Background execution

Before changing background commands or sync execution, read [ADR-0001](../adr/0001-background-command-execution.md).

- RPC contracts and transport belong in `infrastructure/browser/messages.ts`.
- `entrypoints/background/index.ts` owns startup, listener registration, and an exhaustive typed command registry. Its private dispatcher validates payloads by message name and shares one write queue between messages and alarms, including network work and ordered post-handler effects. Reads may overlap writes. Commands mark local edits only when explicitly flagged; workflow-owned tracking and imported timestamps stay with their services.
- Register message and alarm listeners synchronously during startup. Handlers wait for startup readiness before accessing storage.

## Content UI lifecycle

- Mount controls and toasts with WXT `createShadowRootUi` and `cssInjectionMode: 'ui'`. Keep portals inside the shadow root, using the top layer to avoid toolbar clipping. Detect themes from LeetCode's page classes.
- WXT removal unmounts React. Context invalidation also disconnects the toolbar observer and disposes auto-reset, which stays outside React. Components clean up subscriptions and timers on unmount.

## Storage, backup, and sync

- Cards are slug-keyed, notes reference card UUIDs, and stored card dates are numeric.
- Preserve supported card fields, FSRS schedules, notes, stats, settings, and Gist configuration. Unrecognized fields may be discarded; unrelated undecodable records need not survive mutations.
- Before changing schema migrations or startup recovery, read [ADR-0003](../adr/0003-snapshot-migration-input.md) and the migration contract below.
- Infrastructure owns card date codecs, stored-record validation, migrations, and card/note/stat persistence. Persistence adapters do not mark local edits.
- Domain owns import envelope/configuration validation, settings compatibility, and relationship checks without depending on storage types.
- Services parse the import envelope and source version, migrate the raw logical dataset, then normalize and validate current records and relationships before replacement. Preserve historical fields until transformation. Reset/restore uses shared persistence adapters, preserves the local PAT, and applies imported timestamps after settings writes.
- Imports discard extra record and configuration fields while validating supported fields and relationships. Legacy imports default missing card domains to `leetcode.com` and map `autoClearLeetcode` to `resetEditorOnEveryProblem`, with the current setting taking precedence.
- Sync, backup/reset, and local-edit tracking share `infrastructure/storage/sync-metadata.ts`.
- Before changing Gist sync conflict resolution, read [ADR-0002](../adr/0002-whole-dataset-gist-sync.md). Restore pulls through backup import.
- Sync payloads include settings and Gist configuration, exclude the PAT, and need new synchronized fields added to `ExportData`.

### Migration contract and recovery

Append each schema change as a numbered file in `infrastructure/storage/migrations/` and append it to the ordered list in `infrastructure/storage/migrations.ts`. Array position plus one is its version. `LATEST_SCHEMA_VERSION` governs exports and backup compatibility; the stored device version records completed startup steps. Keep historical checks independent of current application models. Versions 1–3 retain the existing learning-data backend.

Each `Migration` supplies:

- `load()`: read the complete historical logical dataset and any additional inputs as lossless JSON data. Keep historical storage layouts in migration adapters such as `legacy-storage.ts`.
- `migrate(input)`: perform the pure, deterministic transformation shared by startup and imports. Validate historical input/output here, preserve unrelated fields, and explicitly define and test repair, discard, and rejection policies.
- `save(output)`: persist the transformed result. Validate and calculate writes first, batching each storage area where practical.
- Optional `cleanup(input)`: remove obsolete sources using the saved original input when needed. Both saving and cleanup must tolerate repeats.

Startup saves `{ version, input }` at `local:leetsrs:migrationSnapshot` before transformation or destination writes. It then transforms, saves destinations, cleans sources, records completion, and retires the snapshot before starting another step. Retry uses the snapshot without calling `load()` again. Transformations need not accept their own output. Keep this recovery key and the completed-version key available in local storage when learning data moves.

A snapshot for the device's completed version is retired without replay. A pending snapshot must identify the next version; malformed metadata, version gaps, older snapshots, and unsupported future versions block startup without changing recovery data. Failures report the step and phase. Background messages and alarms stay behind startup readiness, including after snapshot creation or retirement fails; reload after resolving the failure to retry. Import preparation runs only transformations and current validation; startup snapshots do not provide import replacement rollback.
