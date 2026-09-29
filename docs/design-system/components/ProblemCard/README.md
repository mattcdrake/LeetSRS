# ProblemCard

The popup's card container with problem rows — how reviews, roadmaps and settings group content.

Source: `settingsCard` in `popup/views/settings/SettingsGroup.tsx`, `problemRow` in `popup/styles.ts`, `ReviewCard.tsx`, `CardListItem.tsx`. Static rendition.

- Card: `surface`, 1px `line`, `radius-xl`, `shadow-card`.
- Row: min height 48, bleeds 8px into the card padding, `radius-lg`, hover `raised` (the code uses 70% of it).
- Row title `body` medium; metadata `small` in `fg-3`; status chips `caption` on `brand-soft`.
