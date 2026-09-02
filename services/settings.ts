import { storage } from '#imports';
import { detectBrowserLanguage, translations } from '@/shared/i18n';
import {
  DEFAULT_ANIMATIONS_ENABLED,
  DEFAULT_BADGE_ENABLED,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_MAX_NEW_CARDS_PER_DAY,
  DEFAULT_RESET_EDITOR_ON_DUE_REVIEW,
  DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM,
  DEFAULT_THEME,
  type Language,
  MAX_DAY_START_HOUR,
  MAX_NEW_CARDS_PER_DAY,
  MIN_DAY_START_HOUR,
  MIN_NEW_CARDS_PER_DAY,
  type Settings,
  type Theme,
} from '@/shared/settings';
import { STORAGE_KEYS } from './storage-keys';

type SettingDefinition<T> = {
  storageKey: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
  defaultValue: T | (() => T);
  validate: (value: unknown) => value is T;
  validationError: (value: unknown) => string;
};

type SettingsRegistry = {
  [K in keyof Settings]: SettingDefinition<Settings[K]>;
};

const SETTINGS_REGISTRY = {
  maxNewCardsPerDay: {
    storageKey: STORAGE_KEYS.maxNewCardsPerDay,
    defaultValue: DEFAULT_MAX_NEW_CARDS_PER_DAY,
    validate: (value): value is number =>
      Number.isInteger(value) &&
      (value as number) >= MIN_NEW_CARDS_PER_DAY &&
      (value as number) <= MAX_NEW_CARDS_PER_DAY,
    validationError: (value) =>
      Number.isInteger(value)
        ? `Max new cards per day must be between ${MIN_NEW_CARDS_PER_DAY} and ${MAX_NEW_CARDS_PER_DAY}`
        : 'Max new cards per day must be a whole number',
  },
  dayStartHour: {
    storageKey: STORAGE_KEYS.dayStartHour,
    defaultValue: DEFAULT_DAY_START_HOUR,
    validate: (value): value is number =>
      Number.isInteger(value) && (value as number) >= MIN_DAY_START_HOUR && (value as number) <= MAX_DAY_START_HOUR,
    validationError: (value) =>
      Number.isInteger(value)
        ? `Day start hour must be between ${MIN_DAY_START_HOUR} and ${MAX_DAY_START_HOUR}`
        : 'Day start hour must be a whole number',
  },
  animationsEnabled: {
    storageKey: STORAGE_KEYS.animationsEnabled,
    defaultValue: DEFAULT_ANIMATIONS_ENABLED,
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Animations enabled must be a boolean',
  },
  theme: {
    storageKey: STORAGE_KEYS.theme,
    defaultValue: DEFAULT_THEME,
    validate: (value): value is Theme => value === 'light' || value === 'dark',
    validationError: () => 'Theme must be either "light" or "dark"',
  },
  resetEditorOnEveryProblem: {
    storageKey: STORAGE_KEYS.resetEditorOnEveryProblem,
    defaultValue: DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM,
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Reset editor on every problem must be a boolean',
  },
  resetEditorOnDueReview: {
    storageKey: STORAGE_KEYS.resetEditorOnDueReview,
    defaultValue: DEFAULT_RESET_EDITOR_ON_DUE_REVIEW,
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Reset editor on due review must be a boolean',
  },
  badgeEnabled: {
    storageKey: STORAGE_KEYS.badgeEnabled,
    defaultValue: DEFAULT_BADGE_ENABLED,
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Badge enabled must be a boolean',
  },
  language: {
    storageKey: STORAGE_KEYS.language,
    defaultValue: detectBrowserLanguage,
    validate: (value): value is Language => typeof value === 'string' && value in translations,
    validationError: (value) =>
      `Unsupported language: ${String(value)}. Supported languages: ${Object.keys(translations).join(', ')}`,
  },
} satisfies SettingsRegistry;

function getDefaultValue<K extends keyof Settings>(definition: SettingDefinition<Settings[K]>): Settings[K] {
  return typeof definition.defaultValue === 'function'
    ? (definition.defaultValue as () => Settings[K])()
    : definition.defaultValue;
}

function getSettingDefinition<K extends keyof Settings>(key: K): SettingDefinition<Settings[K]> {
  return SETTINGS_REGISTRY[key] as SettingDefinition<Settings[K]>;
}

async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const definition = getSettingDefinition(key);
  const value: unknown = await storage.getItem(definition.storageKey);
  return definition.validate(value) ? value : getDefaultValue(definition);
}

async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const definition = getSettingDefinition(key);
  if (!definition.validate(value)) {
    throw new Error(definition.validationError(value));
  }
  await storage.setItem(definition.storageKey, value);
}

const SETTING_KEYS = Object.keys(SETTINGS_REGISTRY) as Array<keyof Settings>;

export async function getSettings(): Promise<Settings> {
  const entries = await Promise.all(SETTING_KEYS.map(async (key) => [key, await getSetting(key)] as const));
  return Object.fromEntries(entries) as unknown as Settings;
}

export async function updateSettings(changes: Partial<Settings>): Promise<void> {
  const updates = SETTING_KEYS.flatMap((key) => {
    if (!Object.hasOwn(changes, key)) {
      return [];
    }

    const value: unknown = changes[key];
    const definition = getSettingDefinition(key);
    if (!definition.validate(value)) {
      throw new Error(definition.validationError(value));
    }

    return [{ definition, value }];
  });

  await Promise.all(updates.map(({ definition, value }) => storage.setItem(definition.storageKey, value)));
}

export async function getMaxNewCardsPerDay(): Promise<number> {
  return getSetting('maxNewCardsPerDay');
}

export async function setMaxNewCardsPerDay(value: number): Promise<void> {
  await setSetting('maxNewCardsPerDay', value);
}

export async function getDayStartHour(): Promise<number> {
  return getSetting('dayStartHour');
}

export async function setDayStartHour(value: number): Promise<void> {
  await setSetting('dayStartHour', value);
}

export async function getAnimationsEnabled(): Promise<boolean> {
  return getSetting('animationsEnabled');
}

export async function setAnimationsEnabled(value: boolean): Promise<void> {
  await setSetting('animationsEnabled', value);
}

export async function getTheme(): Promise<Theme> {
  return getSetting('theme');
}

export async function setTheme(value: Theme): Promise<void> {
  await setSetting('theme', value);
}

export async function getResetEditorOnEveryProblem(): Promise<boolean> {
  return getSetting('resetEditorOnEveryProblem');
}

export async function setResetEditorOnEveryProblem(value: boolean): Promise<void> {
  await setSetting('resetEditorOnEveryProblem', value);
}

export async function getResetEditorOnDueReview(): Promise<boolean> {
  return getSetting('resetEditorOnDueReview');
}

export async function setResetEditorOnDueReview(value: boolean): Promise<void> {
  await setSetting('resetEditorOnDueReview', value);
}

export async function getBadgeEnabled(): Promise<boolean> {
  return getSetting('badgeEnabled');
}

export async function setBadgeEnabled(value: boolean): Promise<void> {
  await setSetting('badgeEnabled', value);
}

export async function getLanguage(): Promise<Language> {
  return getSetting('language');
}

export async function setLanguage(value: Language): Promise<void> {
  await setSetting('language', value);
}
