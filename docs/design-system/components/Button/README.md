# Button

The popup's button family: primary, soft (brand tint), compact outline, compact ghost, quiet text, icon, and the danger confirm.

Source: `popup/styles.ts` (`primaryButton`, `compactOutlineButton`, `compactGhostButton`, `textButton`, `iconButton`, `buttonInteraction`) and `popup/components/problem-save/problem-save.css` (the save sheet's `primary` and `card` variants). This is a static rendition — the code has no `<Button>` component; views compose these class strings on react-aria `Button`.

- **Primary** — `brand` fill, `on-brand` text, `control-lg`, `radius-lg`, `body` medium; hover brightness 95%. One per view. Use `primaryButton`.
- **Soft** — `brand-soft` fill, `brand` text; the save action on a card.
- **Outline** — `control-sm`, `line-strong` border, `small` medium weight. Toolbar actions.
- **Ghost** — `control-sm`, `fg-2`, hover `raised` + `fg`. Sort / filter triggers.
- **Text / Icon** — `control-md`, quiet; card action bars. Icon buttons rest in `fg-3`.
- **Danger** — only as the second step of a two-step delete (`danger` fill, `on-danger` text).

The consumer provides the label (and an `aria-label` for icon buttons). Every variant gets the shared focus ring: 2px `focus`, offset 2px. Disabled: opacity .5, not-allowed cursor.
