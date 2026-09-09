import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage } from 'wxt/utils/storage';
import { SETTINGS_CONSTRAINTS, type Settings } from '@/domain/settings';
import { STORAGE_KEYS } from '@/infrastructure/storage/storage-keys';
import { createDeferred } from '@/test/utils/deferred';
import { buildSettings } from '@/test/utils/settings-mocks';
import { exportSettings, getSettings, resetSettings, updateSettings } from '../settings';

describe('settings service', () => {
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it('persists and exports all seven settings', async () => {
    const settings = buildSettings({
      maxNewCardsPerDay: 0,
      dayStartHour: 0,
      theme: 'dark',
      resetEditorOnEveryProblem: true,
      resetEditorOnDueReview: true,
      badgeEnabled: false,
      language: 'zh-CN',
    });
    await updateSettings(settings);
    expect(await getSettings()).toEqual(settings);
    expect(await exportSettings()).toEqual(settings);
  });

  it.each([
    ['maxNewCardsPerDay', -1],
    ['dayStartHour', 24],
    ['theme', 'blue'],
    ['resetEditorOnEveryProblem', 1],
    ['resetEditorOnDueReview', 'true'],
    ['badgeEnabled', 0],
    ['language', 'toString'],
    ['language', 'constructor'],
    ['language', '__proto__'],
  ] as const)('defaults and omits invalid stored %s: %s', async (key, value) => {
    vi.stubGlobal('navigator', { languages: ['pl'] });
    await storage.setItem(STORAGE_KEYS[key], value);
    expect(await getSettings()).toEqual(buildSettings({ language: 'pl' }));
    expect(await exportSettings()).toEqual({});
    expect(await storage.getItem(STORAGE_KEYS[key])).toEqual(value);
  });

  it('ignores undefined, unknown, and inherited updates without writes or tracking', async () => {
    await updateSettings({ theme: 'dark' });
    const setItem = vi.spyOn(storage, 'setItem');
    const changes = Object.assign(Object.create({ badgeEnabled: false }), { theme: undefined, unknown: 1 });
    await updateSettings(changes);
    expect(setItem).not.toHaveBeenCalled();
    expect(await exportSettings()).toEqual({ theme: 'dark' });

    await updateSettings({ theme: undefined, dayStartHour: 5 });
    expect(await exportSettings()).toEqual({ theme: 'dark', dayStartHour: 5 });
  });

  it('validates and persists partial changes', async () => {
    await updateSettings({ maxNewCardsPerDay: 8, theme: 'system' });

    expect(await getSettings()).toEqual(
      buildSettings({
        maxNewCardsPerDay: 8,
        theme: 'system',
      })
    );
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).not.toBeNull();
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
    [{ theme: 'blue' }, 'Theme must be "system", "light", or "dark"'],
    [{ resetEditorOnEveryProblem: 1 }, 'Reset editor on every problem must be a boolean'],
    [{ resetEditorOnDueReview: 1 }, 'Reset editor on due review must be a boolean'],
    [{ badgeEnabled: 'yes' }, 'Badge enabled must be a boolean'],
    [{ language: 'fr' }, 'Unsupported language: fr'],
  ])('rejects invalid update %#', async (changes, error) => {
    await expect(updateSettings(changes as Partial<Settings>)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining(error as string) })]),
    });
    expect(await exportSettings()).toEqual({});
  });

  it('validates all changes before persisting any of them', async () => {
    await expect(updateSettings({ theme: 'dark', maxNewCardsPerDay: -1 })).rejects.toThrowError();
    expect(await exportSettings()).toEqual({});
  });

  it('ignores an empty update', async () => {
    await updateSettings({});
    expect(await exportSettings()).toEqual({});
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it('exports only valid stored values and resets every setting', async () => {
    await updateSettings({ maxNewCardsPerDay: 9, theme: 'light' });
    await storage.setItem(STORAGE_KEYS.language, 'invalid');
    expect(await exportSettings()).toEqual({ maxNewCardsPerDay: 9, theme: 'light' });

    await resetSettings();
    expect(await exportSettings()).toEqual({});
    expect(await getSettings()).toEqual(buildSettings());
  });

  it.each(['system', 'light', 'dark'] as const)('accepts and exports the %s theme', async (theme) => {
    await updateSettings({ theme });

    expect((await getSettings()).theme).toBe(theme);
    expect(await exportSettings()).toEqual({ theme });
  });

  it.each([getSettings, exportSettings])('starts all setting reads concurrently (%#)', async (readSettings) => {
    const firstRead = createDeferred<null>();
    const getItem = vi.spyOn(storage, 'getItem').mockReturnValueOnce(firstRead.promise);

    const pending = readSettings();
    expect(getItem.mock.calls.map(([key]) => key)).toEqual([
      STORAGE_KEYS.maxNewCardsPerDay,
      STORAGE_KEYS.dayStartHour,
      STORAGE_KEYS.theme,
      STORAGE_KEYS.resetEditorOnEveryProblem,
      STORAGE_KEYS.resetEditorOnDueReview,
      STORAGE_KEYS.badgeEnabled,
      STORAGE_KEYS.language,
    ]);

    firstRead.resolve(null);
    await pending;
  });

  it('starts changed writes together and tracks only after every write finishes', async () => {
    const firstWrite = createDeferred<void>();
    const setItem = vi.spyOn(storage, 'setItem').mockReturnValueOnce(firstWrite.promise);

    const pending = updateSettings({ maxNewCardsPerDay: 8, theme: 'dark' });
    expect(setItem.mock.calls).toEqual([
      [STORAGE_KEYS.maxNewCardsPerDay, 8],
      [STORAGE_KEYS.theme, 'dark'],
    ]);
    expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();

    firstWrite.resolve();
    await pending;
    expect(setItem.mock.calls[2]).toEqual([STORAGE_KEYS.dataUpdatedAt, expect.any(String)]);
    expect(setItem).toHaveBeenCalledTimes(3);
  });

  it('preserves successful concurrent writes when another fails and skips tracking', async () => {
    const firstWrite = createDeferred<void>();
    const failure = new Error('setting write failed');
    vi.spyOn(storage, 'setItem').mockReturnValueOnce(firstWrite.promise);

    const pending = updateSettings({ maxNewCardsPerDay: 8, theme: 'dark' });
    const rejected = expect(pending).rejects.toBe(failure);
    expect(await storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    firstWrite.reject(failure);
    await rejected;

    expect(await exportSettings()).toEqual({ theme: 'dark' });
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBeNull();
  });

  it('propagates tracking failure after settings have been persisted', async () => {
    const failure = new Error('tracking write failed');
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) =>
      key === STORAGE_KEYS.dataUpdatedAt ? Promise.reject(failure) : setItem(key, value)
    );

    await expect(updateSettings({ theme: 'dark' })).rejects.toBe(failure);
    expect(await exportSettings()).toEqual({ theme: 'dark' });
  });

  it('starts all reset removals concurrently without changing the data timestamp', async () => {
    await storage.setItem(STORAGE_KEYS.dataUpdatedAt, 'existing timestamp');
    const firstRemoval = createDeferred<void>();
    const removeItem = vi.spyOn(storage, 'removeItem').mockReturnValueOnce(firstRemoval.promise);

    const pending = resetSettings();
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([
      STORAGE_KEYS.maxNewCardsPerDay,
      STORAGE_KEYS.dayStartHour,
      STORAGE_KEYS.theme,
      STORAGE_KEYS.resetEditorOnEveryProblem,
      STORAGE_KEYS.resetEditorOnDueReview,
      STORAGE_KEYS.badgeEnabled,
      STORAGE_KEYS.language,
    ]);
    firstRemoval.resolve();
    await pending;
    expect(await storage.getItem(STORAGE_KEYS.dataUpdatedAt)).toBe('existing timestamp');
  });

  it('does not detect browser language for valid stored language or settings export', async () => {
    const languages = vi.fn(() => ['pl']);
    vi.stubGlobal('navigator', {
      get languages() {
        return languages();
      },
    });
    await storage.setItem(STORAGE_KEYS.language, 'de');
    expect((await getSettings()).language).toBe('de');
    await storage.setItem(STORAGE_KEYS.language, 'invalid');
    expect(await exportSettings()).toEqual({});
    expect(languages).not.toHaveBeenCalled();
  });

  it('resolves language fallback when its own read finishes without waiting for other settings', async () => {
    const firstRead = createDeferred<null>();
    const detected = createDeferred<void>();
    vi.spyOn(storage, 'getItem').mockReturnValueOnce(firstRead.promise);
    vi.stubGlobal('navigator', {
      get languages() {
        detected.resolve();
        return ['pl'];
      },
    });

    const pending = getSettings();
    await detected.promise;
    vi.stubGlobal('navigator', { languages: ['de'] });
    firstRead.resolve(null);
    expect((await pending).language).toBe('pl');
  });
});
