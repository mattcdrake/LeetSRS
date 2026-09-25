// Builds the extension and opens its popup in headless Chromium with a fresh profile.
// See SKILL.md for usage.
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

// Cloud sessions preinstall a Chromium build that may not match this Playwright version.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';

export async function launchExtension() {
  execSync('npx wxt build', { stdio: 'inherit' });

  const extensionPath = resolve('.output/chrome-mv3');
  const profileDir = mkdtempSync(join(tmpdir(), 'leetsrs-playwright-'));
  const executablePath =
    !existsSync(chromium.executablePath()) && existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;

  // The full Chromium build (not the headless shell) is required to load extensions.
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    executablePath,
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: { width: 370, height: 550 },
  });
  const close = async () => {
    await context.close();
    rmSync(profileDir, { recursive: true, force: true });
  };

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const popupUrl = `chrome-extension://${new URL(worker.url()).host}/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    // A fresh profile may open a release announcement, which blocks clicks until dismissed.
    const dialog = page.getByRole('dialog');
    if (
      await dialog.waitFor({ timeout: 3000 }).then(
        () => true,
        () => false
      )
    ) {
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
    }

    return { context, page, popupUrl, close };
  } catch (error) {
    await close();
    throw error;
  }
}
