import { test as base, expect, type Page } from 'playwright/test';
import { launchExtension } from '../.agents/skills/extension-playwright/launch.mjs';
import type { LearningDocument } from '../shared/learning-document';

export const test = base.extend<{ extension: Awaited<ReturnType<typeof launchExtension>> }>({
  // Playwright requires destructuring even when a fixture has no dependencies.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API
  extension: async ({}, use) => {
    const extension = await launchExtension({ build: false });
    try {
      await use(extension);
    } finally {
      await extension.close();
    }
  },
  page: async ({ extension }, use) => use(extension.page),
});
export { expect };

export async function select(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: new RegExp(label) }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

// Seed through the public backup format and real import path, without mocking storage or RPC.
export async function importCards(page: Page, cards: LearningDocument['cards']) {
  await page.getByRole('radio', { name: 'Settings' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  const imported = page.waitForEvent('dialog', (dialog) => dialog.type() === 'alert');
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 12,
        cards,
        settings: {},
        reviewActivity: null,
        activeRoadmapId: null,
        roadmapSkips: {},
      })
    ),
  });
  const dialog = await imported;
  expect(dialog.message()).toBe('Data imported successfully!');
  await dialog.accept();
}
