# Issue #159: Clarify shared module boundaries

- [x] Move `shared/styles.ts` to `entrypoints/popup/styles.ts`, update all popup imports, and remove the old shared module.
- [ ] Colocate `APP_VERSION` and `CHROME_STORE_REVIEWS_URL` with `entrypoints/popup/views/settings/AboutSection.tsx`, then remove `shared/config.ts`.
- [ ] Move the `ProblemData` interface into `utils/content/problem-data.ts`, import `Difficulty` there, consume the type through the content utility barrel in `entrypoints/content.ts`, and remove `shared/problem-data.ts`.
- [ ] Move `LANGUAGE_OPTIONS` into `entrypoints/popup/views/settings/LanguageSection.tsx`, retain its `Language` typing, and update the language-addition instructions in `shared/i18n/index.ts` to point to the UI-owned metadata.
- [ ] Add `shared/stats.ts` containing the public `DailyStats` and `UpcomingReviewStats` contracts, and update `shared/messages.ts`, `services/stats.ts`, import/export code, and tests to import those types from the shared contract module.
- [ ] Audit `shared/` imports and usages: confirm it has no dependency on `services/`, contains only cross-context contracts/runtime data, and leaves `shared/settings.ts` unchanged.
- [ ] Run `npm test` and `npm run compile`.
