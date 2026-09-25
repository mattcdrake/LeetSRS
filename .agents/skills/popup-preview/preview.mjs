// Builds the extension, opens the popup in headless Chromium, and saves light and dark screenshots.
// Usage: node .agents/skills/popup-preview/preview.mjs [--seed] [--out <dir>]
//   --seed  Activate Blind 75 and queue its first 3 problems as new cards.
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    seed: { type: 'boolean', default: false },
    out: { type: 'string', default: '.output/popup-preview' },
  },
});

// Playwright is not a project dependency; use a local install if present, else the global one.
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return import(join(globalRoot, 'playwright', 'index.mjs'));
  }
}

execSync('npx wxt build', { stdio: 'inherit' });

const { chromium } = await loadPlaywright();
const extensionPath = resolve('.output/chrome-mv3');
const outDir = resolve(values.out);
const profileDir = mkdtempSync(join(tmpdir(), 'leetsrs-preview-'));
mkdirSync(outDir, { recursive: true });

// The full Chromium build (not the headless shell) is required to load extensions.
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 370, height: 550 },
});

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const popupUrl = `chrome-extension://${new URL(worker.url()).host}/popup.html`;
  const page = await context.newPage();
  await page.goto(popupUrl);

  // A fresh profile shows the release announcement dialog, which blocks clicks.
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  if (values.seed) {
    // Nav items are radios, not buttons.
    await page.getByRole('radio', { name: 'Roadmaps' }).click();
    await page.getByRole('button', { name: /^Use .*Blind 75/ }).click();
    await page.getByRole('radio', { name: 'Home' }).click();
    for (let count = 1; count <= 3; count++) {
      await page.getByRole('button', { name: /^Save / }).click();
      await page.getByText('Save without rating').click();
      await page.getByTestId('stat-new-count').getByText(String(count), { exact: true }).waitFor();
    }
  }

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(popupUrl);
    await page.getByRole('radio', { name: 'Home' }).waitFor();
    await page.waitForTimeout(500);
    const file = join(outDir, `home-${scheme}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
} finally {
  await context.close();
  rmSync(profileDir, { recursive: true, force: true });
}
