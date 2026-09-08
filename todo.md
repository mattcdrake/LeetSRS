# Consolidate rating vocabulary and presentation

Issue: [#268](https://github.com/mattcdrake/LeetSRS/issues/268)

## Tasks

- [x] Add `domain/ratings.ts` with an ordered, readonly collection of FSRS `Grade` values and stable semantic keys (`again`, `hard`, `good`, `easy`). Keep translations, colors, and rendering outside domain.
- [x] Replace content's grade mapping in `content/ui/theme.ts` with the shared vocabulary. Update `RatingMenu.tsx` and `rating-actions.ts` to use `Grade` throughout the callback-to-message path and remove the `as Grade` cast (now in `rating-actions.ts`, rather than bootstrap).
- [ ] Establish one popup presentation owner for rating colors, shared by `ReviewCard.tsx` and `ReviewHistoryChart.tsx`. Consolidate the existing `App.css` palette with that owner, preserve light/dark palettes, and make chart colors respond to theme changes. Use blue for Good and green for Easy.
- [ ] Generate popup rating buttons and review-history datasets from the shared ordered vocabulary, resolving labels through `t.ratings` in presentation code and indexing statistics by the corresponding grade.
- [ ] Add or update tests for the ordered grade/key contract, content and popup button order and localized labels, exact submitted FSRS values, and chart dataset order, grade counts, labels, and shared colors in both themes. Reuse existing test helpers and cover theme changes and empty history.
- [ ] Manually exercise all four ratings in the LeetCode content menu and popup review queue; confirm the resulting review-history counts and labels. Check English and one non-English locale, plus add-without-rating behavior.
- [ ] Manually compare popup buttons, chart bars, and legend colors in light and dark mode, including switching themes while the chart is open. Capture before/after screenshots of the visual change for the PR.

## Acceptance criteria

- Content buttons, popup buttons, and chart datasets use the same ordered vocabulary: Again (1), Hard (2), Good (3), Easy (4); `Rating.Manual` is excluded.
- Content callbacks carry `Grade` through the rating message without widening to `number` or asserting `as Grade`.
- Labels remain localized in presentation code, and each button submits its displayed grade exactly once.
- Popup buttons and history datasets share one color source; Good is blue and Easy is green in both themes, including after theme changes.
- History retains correct per-grade counts, dates, and empty-state behavior; add-without-rating behavior is unchanged.
- Regression tests and `npm run check` pass, and screenshots document the color correction.
- Architecture boundaries remain intact. Localized sizing (#161), error translation (#248), and changes to `docs/architecture.md` are outside scope.
