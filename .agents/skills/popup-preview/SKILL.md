---
name: popup-preview
description: Build the extension and screenshot the popup's Home tab in light and dark mode using headless Chromium. Use when asked to run, view, or screenshot the popup UI, or to check a UI change visually, especially where `npm run dev` cannot open a browser.
---

# Popup Preview

Run from the repository root:

```sh
node .agents/skills/popup-preview/preview.mjs          # fresh install, empty Home tab
node .agents/skills/popup-preview/preview.mjs --seed   # Blind 75 active, first 3 problems queued as new cards
```

The script builds `.output/chrome-mv3`, loads it into a throwaway Chromium profile at the popup's real size (370×550), and writes `home-light.png` and `home-dark.png` to `.output/popup-preview/` (override with `--out <dir>`). View the images to review the design.

## Requirements

- Dependencies installed (`npm ci`).
- Playwright with its Chromium build, either installed locally or globally. Cloud sessions have both preinstalled; do not run `playwright install` there.

## Notes

- `npm run dev` fails in headless containers because it tries to open Chrome; use this script instead.
- To script other states, extend `preview.mjs`. Bottom-nav items have role `radio`, not `button`, and a fresh profile opens the release announcement dialog, which must be dismissed before clicking anything.
