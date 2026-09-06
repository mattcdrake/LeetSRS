# Proposal: remove `shared/`

Give each module an owner based on its responsibility. Being imported by several
parts of the extension should not determine where a module lives.

This follows [#236](https://github.com/mattcdrake/LeetSRS/issues/236), preserving its
background write ownership and dependency boundaries. Scope is removing `shared/`
and the translation dependency in settings policy; runtime behavior stays the same.

## Proposed ownership

| Current location                             | Proposed location                    | Responsibility                                           |
| -------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `shared/messages.ts`                         | `infrastructure/browser/messages.ts` | Typed extension RPCs and their browser transport         |
| `shared/gist-sync.ts`                        | `domain/gist-sync.ts`                | Gist sync configuration, status, and result models       |
| `shared/i18n/index.ts` and five dictionaries | `i18n/` with the same filenames      | Translation catalog and `Translations` type              |
| `shared/i18n/language.ts`                    | `domain/language.ts`                 | Supported languages, validation, and preference matching |
| `shared/i18n/__tests__/language.test.ts`     | `domain/__tests__/language.test.ts`  | Existing language behavior coverage                      |
| `Language` in `domain/settings.ts`           | `domain/language.ts`                 | Language model alongside its rules                       |

`i18n/` is the only new top-level directory. Its scope is translated text and its
catalog types; it does not absorb messaging, settings access, React hooks, or
unrelated utilities. Do not introduce `common/`, `core/`, or a generic `types/`
replacement.

## Messaging belongs to browser infrastructure

The current message module already combines `ExtensionMessageMap` with
`defineExtensionMessaging` from `@webext-core/messaging`. Move it intact. Keeping
the contract and transport together is sufficient for the current single transport;
splitting them would add a boundary without a current consumer that needs it.

Popup queries and content scripts import `sendMessage` from the new path.
Background registration imports `onMessage` and the message types there too.
`test/utils/message-mocks.ts`, test imports, `vi.mock` targets, and dynamic imports
must all follow the move.

Keep handlers, startup coordination, write serialization, `refreshBadge`, and
`syncTrackingOwner` in `entrypoints/background/`. The transport must not import
services or background registration, including through type-only imports.

Update the UI boundary explicitly: popup/content may use the browser messaging
adapter, but may not import services or persistence. Retain content's existing
read-only `infrastructure/storage/translations.ts` exception. This does not grant
UI code access to all of `infrastructure/`.

Keep message names and payload/result shapes unchanged. Serialized card contracts
remain separate work in the roadmap's #220.

## Sync models belong with the domain models

Move all five declarations to `domain/gist-sync.ts`: `GistSyncConfig`,
`GistSyncStatus`, `SyncResult`, `PatValidationResult`, and `GistValidationResult`.
They describe the extension's sync feature without importing Octokit, browser APIs,
storage, or services. Domain models already include application settings; they need
not be limited to scheduling entities.

This is a deliberate choice to treat Gist sync as an existing product feature.
Retain its specific names instead of inventing a provider-neutral sync abstraction.
`services/github-sync.ts` still owns execution and transient status; the GitHub
client still owns network requests. A type's location does not transfer ownership
of its state or workflow.

Services, messaging, and popup queries import these models directly. Do not put
them in the message module: that would make service signatures depend on transport.
Do not export them from the service implementation: that would require UI-to-service
imports under the current rules, which also cover type-only dependencies.

## Separate language rules from translated text

Today, `domain/settings-policy.ts` imports every dictionary through the translation
catalog to validate a language and build an error message. Language selection also
uses the catalog as its supported-language registry. This creates a dependency
from domain policy to presentation content that a directory move alone would retain.

Make `domain/language.ts` own a small supported-language registry, `Language`, the
English default, `getSupportedLanguage`, and `selectLanguage`. Derive `Language`
from the registry's keys. Keep the current order: `de`, `en`, `hi`, `pl`, `zh-CN`.

- `domain/settings.ts` imports `Language` for `Settings`; other consumers import
  `Language` directly from its owner, without a compatibility re-export.
- `domain/settings-policy.ts` validates against the language registry and uses its
  keys for the existing English error text.
- `i18n/index.ts` imports only the language type from the domain and keeps the
  exhaustive `Record<Language, Translations>` catalog. Adding a language must still
  require its dictionary at compile time.
- `infrastructure/browser/language.ts` reads `navigator.languages` and delegates
  matching to the domain function.
- `infrastructure/storage/translations.ts` retains stored-language lookup and lazy
  browser fallback, importing the rules from domain and dictionaries from `i18n/`.
- Popup `I18nContext`, `ErrorBoundary`, and content consumers use `i18n/`. Language
  display names remain in `LanguageSection.tsx`; they are presentation data.

Preserve exact matching, base-language matching, Chinese fallback, English fallback,
and error wording. Existing tests explicitly preserve inherited-property matching
(`toString` is accepted). For this refactor, use an ordinary object registry and
retain the existing `in` semantics. Switching to `Set.has`, `Object.hasOwn`, or a
null-prototype registry would change behavior and belongs in a separate bug fix.

The resulting dependency direction is `i18n/ → domain/language.ts`. Domain code
does not import `i18n/`; remove the architecture's translation-dictionary exception.
The catalog itself has no browser, storage, service, or UI dependencies.

## Implementation checklist

- [x] Move sync models and update their imports.
- [ ] Move messaging and update all consumers and mock module paths together.
- [ ] Extract the language registry and rules; update settings policy and language
      type imports while preserving the characterized behavior.
- [ ] Move the dictionaries and language tests, then update translation consumers
      and the catalog's new-language instructions.
- [ ] Delete the empty `shared/` directory. Leave no forwarding modules or aliases.
- [ ] Update `AGENTS.md` and `docs/architecture.md` with the ownership table and
      dependency rules above. Check linked review guidance for stale assumptions.
- [ ] Run `npm run check` and `npm run build`. Preserve existing language, settings,
      translation storage, message mock, popup, content, and sync coverage.
- [ ] Inspect remaining `shared/` references: no source imports, mock targets, or
      active architecture guidance should reference it. This proposal may retain
      old paths to explain the migration.

Complete this as one focused refactor, with no storage migration or feature changes.
Existing tests should move with their responsibilities; no new test framework or
automated dependency-enforcement tooling is needed. Review both runtime and
type-only imports against the revised boundaries.

## Acceptance criteria

`shared/` no longer exists, every former module has the owner listed above, and
domain settings/language policy no longer loads translation dictionaries. UI still
uses messaging for workflows, background still owns learning-data writes, and all
existing behavior checks pass. No broader service reorganization, sync redesign,
translation rewrite, or roadmap implementation is included.
