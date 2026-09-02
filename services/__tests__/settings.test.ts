import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { SETTINGS_CONSTRAINTS, type Settings } from '@/shared/settings';
import { buildSettings } from '@/test/utils/settings-mocks';
import { exportSettings, getSettings, resetSettings, updateSettings } from '../settings';
import { STORAGE_KEYS } from '../storage-keys';

describe('settings service', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => vi.unstubAllGlobals());

  it('returns a complete settings object with defaults', async () => {
    expect(await getSettings()).toEqual(buildSettings());
  });

  it('returns stored values and defaults invalid stored values', async () => {
    await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 12);
    await storage.setItem(STORAGE_KEYS.theme, 'invalid');

    expect(await getSettings()).toEqual(buildSettings({ maxNewCardsPerDay: 12 }));
  });

  it('uses the browser language when stored language is missing or invalid', async () => {
    vi.stubGlobal('navigator', { languages: ['pl', 'en'] });
    expect((await getSettings()).language).toBe('pl');
    await storage.setItem(STORAGE_KEYS.language, 'invalid');
    expect((await getSettings()).language).toBe('pl');
  });

  it('validates and persists partial changes', async () => {
    await updateSettings({ maxNewCardsPerDay: 8, animationsEnabled: false, theme: 'light' });

    expect(await getSettings()).toEqual(
      buildSettings({
        maxNewCardsPerDay: 8,
        animationsEnabled: false,
        theme: 'light',
      })
    );
  });

  it.each([
    [{ maxNewCardsPerDay: 1.5 }, 'Max new cards per day must be a whole number'],
    [
      { maxNewCardsPerDay: SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max + 1 },
      `Max new cards per day must be between ${SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min} and ${SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max}`,
    ],
    [{ dayStartHour: 1.5 }, 'Day start hour must be a whole number'],
    [
      { dayStartHour: SETTINGS_CONSTRAINTS.dayStartHour.max + 1 },
      `Day start hour must be between ${SETTINGS_CONSTRAINTS.dayStartHour.min} and ${SETTINGS_CONSTRAINTS.dayStartHour.max}`,
    ],
    [{ animationsEnabled: 'yes' }, 'Animations enabled must be a boolean'],
    [{ theme: 'blue' }, 'Theme must be either "light" or "dark"'],
    [{ resetEditorOnEveryProblem: 1 }, 'Reset editor on every problem must be a boolean'],
    [{ resetEditorOnDueReview: 1 }, 'Reset editor on due review must be a boolean'],
    [{ badgeEnabled: 'yes' }, 'Badge enabled must be a boolean'],
    [{ language: 'fr' }, 'Unsupported language: fr'],
  ])('rejects invalid update %#', async (changes, error) => {
    await expect(updateSettings(changes as Partial<Settings>)).rejects.toThrow(error as string);
    expect(await exportSettings()).toEqual({});
  });

  it('validates all changes before persisting any of them', async () => {
    await expect(updateSettings({ animationsEnabled: false, maxNewCardsPerDay: -1 })).rejects.toThrowError();
    expect(await exportSettings()).toEqual({});
  });

  it('ignores an empty update', async () => {
    await updateSettings({});
    expect(await exportSettings()).toEqual({});
  });

  it('exports only valid stored values and resets every setting', async () => {
    await updateSettings({ maxNewCardsPerDay: 9, theme: 'light' });
    await storage.setItem(STORAGE_KEYS.language, 'invalid');
    expect(await exportSettings()).toEqual({ maxNewCardsPerDay: 9, theme: 'light' });

    await resetSettings();
    expect(await exportSettings()).toEqual({});
    expect(await getSettings()).toEqual(buildSettings());
  });
});
