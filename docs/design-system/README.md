LeetSRS is a quiet study tool that lives in two places: a 370 × 550 browser popup, and a small panel injected into LeetCode.com. Both read one token set. The UI is neutral zinc greys with one green, and gets out of the way of the problems.

## Surfaces

- **Popup** — `canvas` background, content on `surface` cards with a `line` border, `radius-xl` and `shadow-card`. Text is set in `sans` (Geist).
- **On LeetCode** — floating panels on `surface` with `radius-xl` and `shadow-float`. Text is set in `system` (system-ui) so the panel fits in with the host page. This is the one intended type difference. Theme follows LeetCode's `dark` / `dark-theme` class, not `prefers-color-scheme`: set `data-theme` on each surface root.
- Both surfaces use the same `light` and `dark` colour values.

## Content fundamentals

- Short, plain, sentence case: "Rate this problem", "Due in 3 days", "Sign in with GitHub". No exclamation marks in UI chrome, no emoji.
- Address the user as "you" where needed; the product never says "I" or "we".
- Numbers are tabular (`font-variant-numeric: tabular-nums`) wherever they line up: intervals, counts, calendar days, stats.
- All strings come from `shared/i18n`; never hard-code copy in a component.

## Colour

- `brand` (green) is the only accent. Use it for primary fills, links, active nav, progress and focus. Put `on-brand` on a `brand` fill. Use `brand-soft` for tinted chips and counts, with `brand` text on top.
- Neutrals do the rest: `fg` / `fg-2` / `fg-3` for text, `raised` for hover and wells, `raised-2` for pressed or nested fills, `line` / `line-strong` for borders.
- `fg-3` is for metadata and quiet labels. It holds 4.5:1 on `canvas`, `surface` and `raised`.
- Status colours: `danger` fills destructive confirms, with `on-danger` text (never literal white: it fails in dark mode). Use `danger-text` for red text, with `danger-soft` behind notices. Use `warning` for icons and dots and `warning-text` for text. `info` is for icons and dots only, on `info-soft` when the icon sits in a tile.
- Status is never colour alone. Notices always carry an icon (circle-alert, triangle-alert, circle-check, info), and difficulty always carries its word.
- Domain colours: `difficulty-*` for LeetCode difficulty, `rating-again/hard/good/easy` for the four FSRS grades, `heat-1…4` for calendar load. Don't reuse them for anything else.
- `host-fill` / `host-fill-hover` are only for the in-page button that sits in LeetCode's toolbar.

## Type

- Popup scale: `hero` 19, `stat` 17, `view-title` / `sheet-title` 15, `body` 13, `small` 12, `caption` 11. Most controls use `small`, and row titles use `body` at medium weight.
- On LeetCode: `panel-title` 14, `panel-body` 13, `panel-meta` 12, and `wordmark` in the mono subset.
- Weights are 400, 500 and 600 only. Headings get light negative tracking (-0.01em to -0.025em).
- `mono` (JetBrains Mono) is used only for view titles and the wordmark.
- In code, each style is a Tailwind size that carries its line height and tracking: `text-hero`, `text-stat`, `text-title`, `text-body`, `text-xs` (small) and `text-caption` in the popup (`popup/App.css`), and `text-panel-title`, `text-panel-body` and `text-panel-meta` on LeetCode (`content/ui/shadow.css`). Never set a pixel size directly.

## Spacing, size and shape

- Spacing follows a 4px step: `space-1` through `space-4`. Keep the source's half-steps (6px, 10px) where controls use them.
- Control heights: `control-sm` 28 (compact outline and ghost buttons), `control-md` 32 (text and icon buttons, menu items), `control-lg` 36 (primary), `row-comfortable` 44 (rating rows in the sheet).
- Radii: `radius-md` for buttons and days, `radius-lg` for menus, notices and rows, `radius-xl` for cards and panels, and `radius-full` for dots and the switch.
- Borders beat shadows. A card is `line` border + `shadow-card`, and in dark mode that shadow is just a 1px top highlight.

## States and motion

- Hover: fill with `raised`, `row-hover` for list rows, `brand-soft-hover` for `brand-soft` buttons, or a 9–18% tint of the row's own colour (rating rows).
- Focus: a 2px solid `focus` outline, offset 2px, or -2px inside lists and sheets. It is always visible on keyboard focus (`data-focus-visible`).
- Disabled: opacity 0.45–0.55 and a default cursor.
- Selected rating: a 14% tint of the rating colour, plus an inset 1px ring at 55%.
- Transitions: colour changes take 120ms. The sheet slides in over 200ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`, and tooltips enter over 100ms. `prefers-reduced-motion` turns off every animation and transition.

## Iconography

- Use Lucide via `react-icons/lu` for all UI icons: 14px (`size-3.5`) in notices and 16px in buttons, stroked in `currentColor`.
- Font Awesome's `FaGithub` is the single brand-mark exception.
- The LeetSRS mark is `LeetSRSLogo` (`shared/ui/LeetSRSLogo.tsx`): a Lucide-style 2px-stroke arc with a return arrow and trailing dots, drawn in `currentColor` at 1em.

## Layout

- The popup is fixed at 370 × 550, with views above a bottom nav. Sheets cover the whole popup, nav included.
- Menus and sheets sit at z-index 1100.
- Scrollbars are 6px thin and only visible on hover.
