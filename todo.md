# Plan: separate import validation from application (#166)

- [x] Refactor `services/import-export.ts` around a prepared-import type that contains the validated cards, stats, notes, normalized current settings, optional Gist sync values, and resolved `dataUpdatedAt` value needed by the write phase.
- [x] Add a preparation function that parses the JSON, checks the required export structure and schema compatibility, validates every import data section, normalizes legacy settings (`autoClearLeetcode` and `animationsEnabled`), and runs registry-backed settings validation before returning the prepared payload; keep this phase free of storage mutations.
- [x] Add an application function that accepts only prepared data, preserves the existing GitHub PAT, resets stored importable data, restores the PAT, and writes cards, stats, notes, settings, Gist sync state, and the prepared update timestamp.
- [ ] Reduce `importData()` to orchestrating preparation followed by application, removing its ad hoc pre-reset settings-validation step while preserving existing compatibility and error messages.
- [ ] Update `services/__tests__/import-export.test.ts` to cover preparation/normalization separately from application and prove malformed structure, incompatible schemas, invalid data sections, and invalid legacy or current settings all fail before any existing cards, stats, notes, settings, sync state, or PAT are changed.
- [ ] Retain integration coverage that valid, legacy, and empty imports replace existing importable data correctly, preserve the PAT, and use the imported `dataUpdatedAt` or a generated fallback.
- [ ] Run `npm test` and `npm run compile`.
