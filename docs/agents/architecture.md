# Architecture reference

Ownership and implementation constraints. Keep this reference aligned with authorized design changes; historical decisions live in ADRs.

## Ownership and dependencies

These rules apply to runtime and type-only imports:

- `entrypoints/` owns WXT registration, background message execution, popup UI, and query hooks.
- `content/` owns LeetCode DOM/GraphQL integration. `content/ui/` owns presentation; `content/rating-actions.ts` owns problem lookup and background RPC orchestration; `content/bootstrap.tsx` owns mounting and lifecycle.
- `domain/` owns application models and schemas, current document invariants, scheduling, review days, settings, language, and Gist conflict policy. Pass explicit inputs; keep browser, storage, service, messaging, and translation-catalog dependencies out. `ts-fsrs` is allowed.
- `services/` owns write workflows, edit clocks, FSRS lifetime, write order, and sync execution. Services may compose domain rules, adapters, and other services without cycles.
- `infrastructure/storage/learning-queries.ts` owns validated current-data reads and export serialization. Time-derived reads capture one document and time and use shared domain policy for settings, review eligibility, statistics, and editor reset. Readers remain independent of learning-write services, FSRS initialization, and historical conversions.
- `infrastructure/` owns storage keys, codecs, document conversions, backup parsing and historical validation, GitHub requests, browser messaging, and language detection. It must not depend on services or UI.
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

[ADR-0003](../adr/0003-single-document-learning-data.md) records the single-document design. The document is authoritative at runtime. The superseded migration lifecycle and collection/settings persistence wrappers have been removed; historical compatibility lives in the startup bridge and pure document conversions.

- One browser-local document owns its schema version, modification timestamp, slug-keyed cards with embedded notes, daily statistics, and stored settings overrides. Card timestamps use epoch milliseconds; `dataUpdatedAt` is an optional timestamp string, and statistics use local `YYYY-MM-DD` dates. Missing settings retain normal defaults, including browser-language detection.
- Domain owns current schemas and explicit-input policy. Named local workflows in `services/learning.ts` prepare complete changes and pass their captured edit time to a private shared save helper. This shared save path prepares the timestamp and calls the writer, which owns final completed-document validation before one write. Command payload schemas own early input validation and settings-update normalization; workflows consume those parsed inputs without repeating those checks. Reviews commit cards, statistics, and their edit timestamp together; queue calculations use one captured document and time. Keep normal operations behind startup readiness and the existing background write queue.
- `infrastructure/storage/learning-document.ts` owns current-document reads, the shared required-document check, and validating replacement through the shared storage keys. `learning-document-conversions.ts` owns backup parsing and pure version-conversion orchestration shared by startup, import, and Gist pull. `document-conversions/` owns the frozen historical contracts and individual conversions. Preserve supported historical versions and their meaning, frozen historical data contracts, and precedence rules. Validate historical input before stripping extras and validate the current result. Keep browser storage, clocks, per-step loaders/savers/cleanup, physical-layout modules, and intermediate completion writes out of the conversion sequence.
- One startup bridge gathers scattered legacy values only when the new document is absent. Prepare and validate before writing the complete document and its version. After success the document is authoritative; cleanup failure must not trigger re-import, and corrupt or future documents must not fall back to stale legacy keys. Preserve credentials and already-combined connection values over retained legacy fields.
- File backups and Gist payloads use the document representation. Import validates and converts before one replacement, preserves the imported timestamp, and clears omitted notes/settings through replacement. Retain legacy backup timestamp fallback without treating conversion as a learner edit.
- The PAT, Gist ID, and automatic-sync setting remain a separate browser-synced connection. Sync status stays local. Import leaves both untouched; explicit Reset All Data also clears the connection, retained legacy connection keys, and local status.
- Whole-dataset conflict resolution remains [ADR-0002](../adr/0002-whole-dataset-gist-sync.md). Reject unsupported remote formats before replacing data or writing a Gist. All browsers sharing a Gist must update before resuming sync; the transition does not support dual writes or old and new clients syncing together.
- Preserve supported learning data and meaningful failure behavior. Keep obsolete migration/persistence machinery and sequencing-only tests out of the runtime and test suite. A single document does not imply a transaction across connection/status writes or a crash-recovery framework.
