# #162 — Use system theme

Assumption: add `system` as a third theme preference and make it the default, while preserving explicit light and dark overrides. Existing stored choices should remain unchanged.

## Settings model

- [x] Extend `Theme` in `shared/settings.ts` to include `system`.
- [x] Change the theme default in `services/settings.ts` from `dark` to `system` and accept all three values during validation.
- [x] Update the validation error and settings-service tests for `system`, invalid values, and the new default.
- [x] Update `test/utils/settings-mocks.ts` so the default fixture uses `system`.
- [x] Keep existing `light` and `dark` stored/exported values valid; no storage migration is needed because missing values already resolve through the default.
- [x] Extend import/export tests to verify that `system` round-trips and legacy light/dark exports still import unchanged.

## Theme resolution

- [ ] Add a small popup hook or utility that resolves `system` with `window.matchMedia('(prefers-color-scheme: dark)')` and otherwise returns the explicit preference.
- [ ] Subscribe to the media query's `change` event only while the preference is `system`, and clean up the listener on preference changes or unmount.
- [ ] In `entrypoints/popup/App.tsx`, apply only the resolved `light` or `dark` class to `<html>` and `<body>`; never apply `system` as a CSS theme class.
- [ ] Set `color-scheme` consistently with the resolved theme so browser-rendered controls match the popup.
- [ ] Preserve the current system-aware loading state in `App.css` to avoid a light/dark flash before settings load.

## Appearance UI

- [ ] Replace the binary dark-mode switch in `AppearanceSection.tsx` with an accessible three-choice control for System, Light, and Dark (the existing `react-aria-components` select pattern is reusable).
- [ ] Add labels for the theme field and all three choices to every locale in `shared/i18n/`.
- [ ] Keep animations and badge controls unchanged.

## Tests and verification

- [ ] Add focused tests for explicit light, explicit dark, system-light, and system-dark resolution.
- [ ] Test that a live OS theme change updates the applied classes when set to System, including listener cleanup; mock `matchMedia` locally or add a reusable typed test helper if multiple tests need it.
- [ ] Add an `AppearanceSection` test that selecting each option sends the corresponding `updateSettings` change.
- [ ] Check the popup manually in all three modes, including changing the OS theme while the popup is open and reopening it afterward.
- [ ] Run `npm test`, `npm run compile`, and `npm run format:check`.

## Done when

- [ ] Fresh and reset installs follow the operating-system theme by default.
- [ ] System mode reacts to OS theme changes without reopening the popup.
- [ ] Explicit Light and Dark modes ignore OS theme changes.
- [ ] Existing users retain their saved explicit theme preference.
