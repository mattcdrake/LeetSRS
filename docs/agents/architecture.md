# Architecture reference

Ownership and implementation constraints. Keep this reference aligned with authorized design changes; historical decisions live in ADRs. Accepted changes awaiting implementation are identified below.

## Ownership and dependencies

These rules apply to runtime and type-only imports:

- `entrypoints/` owns WXT registration, background message execution, popup UI, and query hooks.
- `content/` owns LeetCode DOM/GraphQL integration. `content/ui/` owns presentation; `content/rating-actions.ts` owns problem lookup and background RPC orchestration; `content/bootstrap.tsx` owns mounting and lifecycle.
- `domain/` owns application models and schemas, scheduling, review days, settings, and language. Pass explicit inputs; keep browser, storage, service, messaging, and translation-catalog dependencies out. `ts-fsrs` is allowed.
- `services/` owns workflows, clocks, settings reads, FSRS lifetime, write order, and sync decisions. Services may compose domain rules, adapters, and other services without cycles. Statistics and editor reset read cards through persistence rather than the card service.
- `infrastructure/` owns storage keys, codecs, migrations, backup-format parsing and relationship checks, GitHub requests, browser messaging, and language detection. It must not depend on services or UI.
- `i18n/` owns translation catalogs and the `Translations` type. It may import the domain language type, but has no browser, storage, service, or UI dependencies. Settings policy uses the domain language registry without loading dictionaries.
- Popup and content workflows use `infrastructure/browser/messages.ts` rather than importing services or persistence. Content may use the read-only `infrastructure/storage/translations.ts` adapter.
- The popup owns permissions, active-tab inspection, and banner dismissal state. Permission requests originate from user interactions.

## Background execution

Before changing background commands or sync execution, read [ADR-0001](../adr/0001-background-command-execution.md).

- RPC contracts and transport belong in `infrastructure/browser/messages.ts`.
- `entrypoints/background/index.ts` owns startup, listener registration, and an exhaustive typed command registry. Its private dispatcher validates payloads by message name and shares one write queue between messages and alarms, including network work and ordered post-handler effects. Reads may overlap writes. Prepared document writes include local-edit timestamps; imported timestamps remain unchanged. Badge failures must not overturn a successful data write.
- Register message and alarm listeners synchronously during startup. Handlers wait for startup readiness before accessing storage.

## Content UI lifecycle

- Mount controls and toasts with WXT `createShadowRootUi` and `cssInjectionMode: 'ui'`. Keep portals inside the shadow root, using the top layer to avoid toolbar clipping. Detect themes from LeetCode's page classes.
- WXT removal unmounts React. Context invalidation also disconnects the toolbar observer and disposes auto-reset, which stays outside React. Components clean up subscriptions and timers on unmount.

## Storage, backup, and sync

[ADR-0003](../adr/0003-single-document-learning-data.md) records the single-document design. The document is authoritative at runtime; the [canonical implementation plan](https://github.com/mattcdrake/LeetSRS/issues/371) tracks the remaining superseded-code cleanup.

- One browser-local document owns its schema version, modification timestamp, slug-keyed cards with embedded notes, daily statistics, and stored settings overrides. Dates remain numbers. Missing settings retain normal defaults, including browser-language detection.
- Domain owns current schemas and explicit-input policy. Services prepare and validate complete changes, including timestamps, before infrastructure writes the document once. Reviews commit cards, statistics, and their edit timestamp together; queue calculations use one captured document and time. Keep normal operations behind startup readiness and the existing background write queue.
- Migrations are pure document-version conversions shared by startup and backup import. Preserve supported historical versions and their meaning, frozen historical data contracts, and precedence rules. Validate historical input before stripping extras and validate the current result. Keep browser storage, clocks, per-step loaders/savers/cleanup, physical-layout modules, and intermediate completion writes out of the conversion sequence.
- One startup bridge gathers scattered legacy values only when the new document is absent. Prepare and validate before writing the complete document and its version. After success the document is authoritative; cleanup failure must not trigger re-import, and corrupt or future documents must not fall back to stale legacy keys. Preserve credentials and already-combined connection values over retained legacy fields.
- File backups and Gist payloads use the document representation. Import validates and converts before one replacement, preserves the imported timestamp, and clears omitted notes/settings through replacement. Retain legacy backup timestamp fallback without treating conversion as a learner edit.
- The PAT, Gist ID, and automatic-sync setting remain a separate browser-synced connection. Sync status stays local. Import leaves both untouched; explicit Reset All Data also clears the connection, retained legacy connection keys, and local status.
- Whole-dataset conflict resolution remains [ADR-0002](../adr/0002-whole-dataset-gist-sync.md). Reject unsupported remote formats before replacing data or writing a Gist. All browsers sharing a Gist must update before resuming sync; the transition does not support dual writes or old and new clients syncing together.
- Preserve supported learning data and meaningful failure behavior. The implementation must remove the superseded migration/persistence machinery and sequencing-only tests. A single document does not imply a transaction across connection/status writes or a crash-recovery framework.
