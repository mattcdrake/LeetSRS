# Consolidate rating vocabulary and presentation

Issue: [#268](https://github.com/mattcdrake/LeetSRS/issues/268)

## Tasks

- [x] Add `domain/ratings.ts` with an ordered, readonly collection of FSRS `Grade` values and stable semantic keys (`again`, `hard`, `good`, `easy`). Keep translations, colors, and rendering outside domain.
- [x] Replace content's grade mapping in `content/ui/theme.ts` with the shared vocabulary. Update `RatingMenu.tsx` and `rating-actions.ts` to use `Grade` throughout the callback-to-message path and remove the `as Grade` cast (now in `rating-actions.ts`, rather than bootstrap).
- [x] Establish one popup presentation owner for rating colors, shared by `ReviewCard.tsx` and `ReviewHistoryChart.tsx`. Consolidate the existing `App.css` palette with that owner, preserve light/dark palettes, and make chart colors respond to theme changes. Use blue for Good and green for Easy.
- [x] Move `entrypoints/popup/rating-colors.ts` to shared presentation module `ui/rating-colors.ts`, keyed by domain `RatingKey` with locally defined light/dark theme keys instead of a popup hook dependency. Update popup imports and make `content/ui/theme.ts` consume the shared base colors while retaining its hover colors. Keep `domain/ratings.ts` unchanged.
- [x] Generate popup rating buttons and review-history datasets from the shared ordered vocabulary, resolving labels through `t.ratings` in presentation code and indexing statistics by the corresponding grade.
- [x] Add a shared problem-difficulty palette in `ui/difficulty-colors.ts`, keyed by the existing domain `Difficulty` type. Consolidate `App.css` difficulty colors and the mappings in `ReviewCard.tsx` and `CardListItem.tsx` so badges and text use the same Easy/Medium/Hard palette (green/amber/red). Keep it independent of popup/content code and separate from FSRS rating colors.
- [x] Add or update tests for the ordered grade/key contract, content and popup button order and localized labels, exact submitted FSRS values, and chart dataset order, grade counts, and labels. Reuse existing test helpers and cover empty history. Keep color checks in manual visual review rather than automated tests.
- [ ] Manually exercise all four ratings in the LeetCode content menu and popup review queue; confirm the resulting review-history counts and labels. Check English and one non-English locale, plus add-without-rating behavior.
- [ ] Manually compare content buttons, popup buttons, chart bars, and legend colors in matching light and dark modes, including switching themes while the menu or chart is open. Confirm content hover colors are unchanged. Capture before/after screenshots of the visual change for the PR.
- [ ] Manually compare Easy, Medium, and Hard badges in the review queue with difficulty text in the card list in both themes; check matching colors and readability, and capture screenshots of the visual change.

## Acceptance criteria

- Content buttons, popup buttons, and chart datasets use the same ordered vocabulary: Again (1), Hard (2), Good (3), Easy (4); `Rating.Manual` is excluded.
- Content callbacks carry `Grade` through the rating message without widening to `number` or asserting `as Grade`.
- Labels remain localized in presentation code, and each button submits its displayed grade exactly once.
- Content buttons, popup buttons, and history datasets share one base color source outside domain; Good is blue and Easy is green in both themes, including after theme changes. Content retains its existing hover colors, and the shared palette has no popup or content dependencies.
- History retains correct per-grade counts, dates, and empty-state behavior; add-without-rating behavior is unchanged.
- Problem-difficulty badges and text share one presentation palette: Easy green, Medium amber, Hard red in both themes. Difficulty colors remain independent of FSRS rating colors, and stored difficulty values are unchanged.
- Regression tests and `npm run check` pass, and screenshots document the color correction.
- Architecture boundaries remain intact. Localized sizing (#161), error translation (#248), and changes to `docs/architecture.md` are outside scope.
