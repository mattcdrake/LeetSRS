---
name: extension-playwright
description: Drive the built extension's popup in headless Chromium with Playwright. Use when asked to run, view, screenshot, or click through the popup UI, or to check a UI change in the real extension, especially where `npm run dev` cannot open a browser.
---

# Extension Playwright

`launch.mjs` builds the extension, loads it into a throwaway Chromium profile, opens the popup at its real size (370×550), and dismisses the release announcement. Write a short script for the task that imports it, and keep that script outside the repository:

```js
import { launchExtension } from "<repo>/.agents/skills/extension-playwright/launch.mjs";

const { page, popupUrl, close } = await launchExtension();
try {
  await page.getByRole("radio", { name: "Roadmaps" }).click();
  await page.screenshot({ path: "roadmaps.png" });
} finally {
  await close();
}
```

Run it with `node` from the repository root; the launcher builds from the current working directory.

## Requirements

- `npm ci`.
- On a local machine, run `npx playwright install chromium` once. Cloud sessions have Chromium preinstalled; the launcher falls back to it when Playwright's own build is missing, so do not run `playwright install` there.

## Recipes

- **Navigate:** bottom-nav items have role `radio`, not `button`: `page.getByRole('radio', { name: 'Home' })`.
- **Activate a roadmap:** on Roadmaps, click `getByRole('button', { name: 'Use Blind 75' })`.
- **Save the next roadmap problem:** on Home, click `getByRole('button', { name: /^Save / })`, then `getByText('Save without rating')` to queue it as a new card, or a rating option to schedule it.
- **Wait for the queue:** `getByTestId('stat-new-count')` and `getByTestId('stat-review-count')` hold the header counts.
- **Dark mode:** `await page.emulateMedia({ colorScheme: 'dark' })`, then `page.goto(popupUrl)` to reload.
- **Fresh state:** each launch starts with empty storage; state persists only until `close()`.

## Notes

- `npm run dev` fails in headless containers because it tries to open Chrome; use this launcher instead.
- Labels come from `shared/i18n/en.ts`; check there when a selector does not match.
