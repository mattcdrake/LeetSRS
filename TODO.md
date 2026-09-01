# Messaging migration

- [x] Add `@webext-core/messaging` as a runtime dependency.
- [x] Replace the custom extension message types with an idiomatic protocol map.
- [x] Register extension message handlers with `onMessage` in the background.
- [x] Migrate popup and content-script callers to the new `sendMessage` API.
- [x] Update messaging tests and cover payload and no-payload messages.
- [ ] Update the messaging architecture invariant in `AGENTS.md`.
- [ ] Run formatting, lint, type-checking, tests, and a production build.
