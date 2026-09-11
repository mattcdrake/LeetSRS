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
- Schema changes require a new numbered module in `infrastructure/storage/migrations/`, appended to the sequence in `infrastructure/storage/migrations/runner.ts`.
- Each migration declares its historical input and output contracts. A loader validates the preceding migration's output shape; its saver accepts its own output type. Keep historical validation and storage keys independent of current application models and layout changes.
- Use `Input`, `Output`, `validateInput`, and `validateOutput` consistently within each migration. Export `Output` and `validateOutput` for the next migration, which imports them as `Input` and `validateInput`. When a local input validator adds checks or error context, import the preceding validator as `validatePreviousOutput` and call it from `validateInput`. For an identity migration, use `export type Output = Input` and alias the validator with `export const validateOutput: typeof validateInput = validateInput`. Validators accept `unknown` and assert their validated type; local helper types may express additional narrowing. Keep the lifecycle names `load`, `migrate`, `save`, and optional `cleanup`.
- A physical layout reader knows where values are stored and how to assemble them into a raw dataset; it does not validate a migration's data schema. Each migration's loader validates those raw values against its historical input contract. For example, adding a card's `domain` field changes the migration's output contract, but the same reader can still retrieve cards from the same storage key. Introduce a new layout reader when storage locations or assembly rules change.
- Startup recovery follows [ADR-0003](../adr/0003-snapshot-migration-input.md). Validate the completed version and any pending snapshot against the same sequence before changes. A snapshot's version must be the completed step or its immediate successor, within the supported sequence; reject malformed, stale, unsupported, or inconsistent metadata without deleting it.
- Before destination changes, capture the pending migration's complete original `Input`, including cleanup inputs, as lossless JSON. Store one `{ version, input }` snapshot at `local:leetsrs-migration:pending`, outside the `leetsrs:` dataset namespace. Reject values JSON would discard or coerce; snapshot creation failure leaves destination data unchanged. Physical layout readers must never collect recovery metadata.
- Finish each startup step in order: load and snapshot input, transform and validate, save destination data, clean obsolete sources, record the completed version, then retire the snapshot. Saving and cleanup must be repeatable and preserve recovery metadata, including during storage moves. Never clear an entire storage area containing recovery metadata. Finish the step before loading the next historical representation.
- Retry a pending step from its saved original input through its own historical transformation, typed saver, and cleanup, without rereading partially changed sources. If completion was recorded but snapshot retirement failed, retire the snapshot without replaying the step. Report the failing step and lifecycle phase, preserve available recovery input, and keep registered messages and alarms behind the existing startup readiness gate until a fresh startup succeeds.
- The runner assumes no dataset shape or physical layout version. Backup migration invokes only the same pure transformations; it does not create or retire startup snapshots. Recovery covers interrupted upgrades, not backup history, rollback of completed steps, or import replacement rollback.
- Shared physical layout readers live in `infrastructure/storage/migrations/layouts/vN.ts` and export `readDataset`. `N` is the schema version that introduced the layout, not the only version it supports: migrations 1–3 use `layouts/v0.ts`. Reuse a reader while the physical layout remains compatible. When a migration introduces a new layout, retain the old module and add one named for that migration's version; the migration reads the old layout and writes the new one, which later migrations read. Never rename an existing layout module to reflect which layout is current.
- Infrastructure owns card date codecs, stored-record validation, migrations, and card/note/stat persistence. Persistence adapters do not mark local edits.
- Domain owns import envelope/configuration validation, settings compatibility, and relationship checks without depending on storage types.
- Services migrate and validate imports before replacement, then orchestrate reset/restore through shared persistence adapters. Preserve the local PAT and apply imported timestamps after settings writes.
- Imports discard extra record and configuration fields while validating supported fields and relationships. Legacy imports default missing card domains to `leetcode.com` and map `autoClearLeetcode` to `resetEditorOnEveryProblem`, with the current setting taking precedence.
- Sync, backup/reset, and local-edit tracking share `infrastructure/storage/sync-metadata.ts`.
- Before changing Gist sync conflict resolution, read [ADR-0002](../adr/0002-whole-dataset-gist-sync.md). Restore pulls through backup import.
- Sync payloads include settings and Gist configuration, exclude the PAT, and need new synchronized fields added to `ExportData`.
