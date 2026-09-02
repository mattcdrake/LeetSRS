# Issue #148: Replace individual setting APIs with one settings module

## Goal

Clients should receive one typed settings object and read values directly:

```ts
settings.maxNewCardsPerDay;
settings.theme;
settings.language;
```

Storage keys, defaults, validation, browser-language fallback, and sync behavior are implementation details of the settings module. Clients should not read registry metadata or apply defaults themselves.

## API

- `getSettings(): Promise<Settings>` returns a complete, validated settings object with defaults applied.
- `updateSettings(changes: Partial<Settings>): Promise<void>` validates and persists changes.
- The React API returns a complete `Settings` object so components only read `settings.<name>`.
- Replace the individual setting messages, hooks, getters, and setters. Do not preserve them for compatibility.

## Work

- [x] Define the `Settings` type and internal metadata for storage keys, defaults, and validation.
- [x] Implement `getSettings()` and `updateSettings()`.
- [x] Replace individual background messages with get/update settings messages.
- [x] Replace individual React Query hooks with settings-level query and mutation hooks.
- [x] Update all clients to read from the settings object.
- [x] Make the React settings API return non-optional `Settings` through a loading or suspense boundary; clients must access `settings.<name>` directly, without handling `undefined`, optional chaining, ternaries, fallback values, or loading guards.
- [x] Reduce `shared/settings.ts` to the public cross-context contract; move defaults, registry metadata, validation, and other implementation-only details into the settings service.
- [ ] Drive backup export, import, and reset from the same internal metadata.
- [ ] Ensure synchronized setting changes call `markDataUpdated()`.
- [ ] Test defaults, validation, updates, import/export, reset, and sync tracking.
- [ ] Run `npm run check`.

## Constraints

- Keep existing physical storage keys and backup field names.
- Preserve dynamic browser-language fallback when language is unset or invalid.
- Do not export defaults that have never been stored.
- Keep cards, stats, notes, migrations, GitHub credentials, and sync state outside settings.
- Keep only public cross-context types and contracts in `shared/settings.ts`; storage keys, defaults, validation, fallback logic, and registry metadata must remain private to the settings service.
- Settings consumers must never supply fallback values or branch on settings availability; loading must be resolved before consumer code runs.
- Do not expose the internal settings registry to clients.
- Do not create commits or pull requests.
