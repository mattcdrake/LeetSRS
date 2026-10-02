# RatingOptions

The four FSRS grades (Again / Hard / Good / Easy) with their next intervals — shared by the in-page LeetCode panel and the popup's save sheet.

Source: `shared/ui/RatingOptions.tsx`, `shared/ui/rating.css`, `shared/ui/rating-colors.ts`, `content/ui/RatingMenu.tsx`.

- Each row sets `--rating-color` to its `rating-*` token; hover tints 9%, selected 14% plus an inset ring at 55%.
- Compact size (on LeetCode): 36px rows with `rating-kbd` shortcut chips. Comfortable size (`data-size="comfortable"`, popup sheet): `row-comfortable` rows, no shortcuts.
- On LeetCode the panel also shows `rating-kbd` chips for the letter shortcuts, which stay the same before and after saving: `R` on the Up next review row, `N` on the roadmap row (both in place of a chevron), and `U` on Undo.
- On LeetCode the panel uses `system` type, `radius-xl` and `shadow-float`, headed by the `wordmark`.
- The consumer provides the intervals and the `onSelect` handler; loading shows `raised` skeleton pills in place of intervals.
