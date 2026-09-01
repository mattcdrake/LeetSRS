# Messaging migration

- [x] Add `@webext-core/messaging` as a runtime dependency.
- [x] Replace the custom extension message types with an idiomatic protocol map.
- [x] Register extension message handlers with `onMessage` in the background.
- [ ] Migrate popup and content-script callers to the new `sendMessage` API.
- [ ] Update messaging tests and add coverage for both protocol maps.
- [ ] Update the messaging architecture invariant in `AGENTS.md`.
- [ ] Run formatting, lint, type-checking, tests, and a production build.
