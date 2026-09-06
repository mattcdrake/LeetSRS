import { getSupportedLanguage, type Language, SUPPORTED_LANGUAGES } from './language';
import { SETTINGS_CONSTRAINTS, type Settings, type Theme } from './settings';

// Language defaults are resolved from browser preferences by the service.
export const DEFAULT_SETTINGS = {
  maxNewCardsPerDay: 3,
  dayStartHour: 0,
  theme: 'system',
  resetEditorOnEveryProblem: false,
  resetEditorOnDueReview: false,
  badgeEnabled: true,
} satisfies Omit<Settings, 'language'>;

type SettingDefinition<T> = {
  validate: (value: unknown) => value is T;
  validationError: (value: unknown) => string;
};

type SettingsRegistry = {
  [K in keyof Settings]: SettingDefinition<Settings[K]>;
};

const SETTINGS_REGISTRY = {
  maxNewCardsPerDay: {
    validate: (value): value is number =>
      Number.isInteger(value) &&
      (value as number) >= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min &&
      (value as number) <= SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max,
    validationError: (value) =>
      Number.isInteger(value)
        ? `Max new cards per day must be between ${SETTINGS_CONSTRAINTS.maxNewCardsPerDay.min} and ${SETTINGS_CONSTRAINTS.maxNewCardsPerDay.max}`
        : 'Max new cards per day must be a whole number',
  },
  dayStartHour: {
    validate: (value): value is number =>
      Number.isInteger(value) &&
      (value as number) >= SETTINGS_CONSTRAINTS.dayStartHour.min &&
      (value as number) <= SETTINGS_CONSTRAINTS.dayStartHour.max,
    validationError: (value) =>
      Number.isInteger(value)
        ? `Day start hour must be between ${SETTINGS_CONSTRAINTS.dayStartHour.min} and ${SETTINGS_CONSTRAINTS.dayStartHour.max}`
        : 'Day start hour must be a whole number',
  },
  theme: {
    validate: (value): value is Theme => value === 'system' || value === 'light' || value === 'dark',
    validationError: () => 'Theme must be "system", "light", or "dark"',
  },
  resetEditorOnEveryProblem: {
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Reset editor on every problem must be a boolean',
  },
  resetEditorOnDueReview: {
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Reset editor on due review must be a boolean',
  },
  badgeEnabled: {
    validate: (value): value is boolean => typeof value === 'boolean',
    validationError: () => 'Badge enabled must be a boolean',
  },
  language: {
    validate: (value): value is Language => getSupportedLanguage(value) !== undefined,
    validationError: (value) =>
      `Unsupported language: ${String(value)}. Supported languages: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`,
  },
} satisfies SettingsRegistry;

export function getSettingDefinition<K extends keyof Settings>(key: K): SettingDefinition<Settings[K]> {
  return SETTINGS_REGISTRY[key] as SettingDefinition<Settings[K]>;
}

export const SETTING_KEYS = Object.keys(SETTINGS_REGISTRY) as Array<keyof Settings>;

export function validateSettings(changes: Partial<Settings>): void {
  for (const key of SETTING_KEYS) {
    if (!Object.hasOwn(changes, key)) continue;
    const value: unknown = changes[key];
    const definition = getSettingDefinition(key);
    if (!definition.validate(value)) {
      throw new Error(definition.validationError(value));
    }
  }
}
