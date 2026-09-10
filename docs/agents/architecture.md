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
- `entrypoints/background/message-handlers.ts` wires services; `message-runner.ts` owns shared execution and types without service imports.
- Register message and alarm listeners synchronously during startup. Handlers wait for startup readiness before accessing storage.

## Content UI lifecycle

- Mount controls and toasts with WXT `createShadowRootUi` and `cssInjectionMode: 'ui'`. Keep portals inside the shadow root, using the top layer to avoid toolbar clipping. Detect themes from LeetCode's page classes.
- WXT removal unmounts React. Context invalidation also disconnects the toolbar observer and disposes auto-reset, which stays outside React. Components clean up subscriptions and timers on unmount.

## Storage, backup, and sync

- Cards are slug-keyed, notes reference card UUIDs, and stored card dates are numeric.
- Preserve supported card fields, FSRS schedules, notes, stats, settings, and Gist configuration. Unrecognized fields may be discarded; unrelated undecodable records need not survive mutations.
- Schema changes require a new sequential migration in `infrastructure/storage/migrations.ts`.
- Infrastructure owns card date codecs, stored-record validation, migrations, and card/note/stat persistence. Persistence adapters do not mark local edits.
- Domain owns import envelope/configuration validation, settings compatibility, and relationship checks without depending on storage types.
- Services migrate and validate imports before replacement, then orchestrate reset/restore through shared persistence adapters. Preserve the local PAT and apply imported timestamps after settings writes.
- Imports discard extra record and configuration fields while validating supported fields and relationships. Legacy imports default missing card domains to `leetcode.com` and map `autoClearLeetcode` to `resetEditorOnEveryProblem`, with the current setting taking precedence.
- Sync, backup/reset, and local-edit tracking share `infrastructure/storage/sync-metadata.ts`.
- Before changing Gist sync conflict resolution, read [ADR-0002](../adr/0002-whole-dataset-gist-sync.md). Restore pulls through backup import.
- Sync payloads include settings and Gist configuration, exclude the PAT, and need new synchronized fields added to `ExportData`.
