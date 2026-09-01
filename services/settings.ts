import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';
import { detectBrowserLanguage, translations } from '@/shared/i18n';
import {
  DEFAULT_MAX_NEW_CARDS_PER_DAY,
  MIN_NEW_CARDS_PER_DAY,
  MAX_NEW_CARDS_PER_DAY,
  DEFAULT_DAY_START_HOUR,
  MIN_DAY_START_HOUR,
  MAX_DAY_START_HOUR,
  type Theme,
  DEFAULT_THEME,
  DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM,
  DEFAULT_RESET_EDITOR_ON_DUE_REVIEW,
  DEFAULT_BADGE_ENABLED,
  type Language,
} from '@/shared/settings';

export async function getMaxNewCardsPerDay(): Promise<number> {
  const value = await storage.getItem<number>(STORAGE_KEYS.maxNewCardsPerDay);
  return value ?? DEFAULT_MAX_NEW_CARDS_PER_DAY;
}

export async function setMaxNewCardsPerDay(value: number): Promise<void> {
  if (!Number.isInteger(value)) {
    throw new Error('Max new cards per day must be a whole number');
  }
  if (value < MIN_NEW_CARDS_PER_DAY || value > MAX_NEW_CARDS_PER_DAY) {
    throw new Error(`Max new cards per day must be between ${MIN_NEW_CARDS_PER_DAY} and ${MAX_NEW_CARDS_PER_DAY}`);
  }
  await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, value);
}

export async function getDayStartHour(): Promise<number> {
  const value = await storage.getItem<number>(STORAGE_KEYS.dayStartHour);
  return value ?? DEFAULT_DAY_START_HOUR;
}

export async function setDayStartHour(value: number): Promise<void> {
  if (!Number.isInteger(value)) {
    throw new Error('Day start hour must be a whole number');
  }
  if (value < MIN_DAY_START_HOUR || value > MAX_DAY_START_HOUR) {
    throw new Error(`Day start hour must be between ${MIN_DAY_START_HOUR} and ${MAX_DAY_START_HOUR}`);
  }
  await storage.setItem(STORAGE_KEYS.dayStartHour, value);
}

export async function getAnimationsEnabled(): Promise<boolean> {
  const value = await storage.getItem<boolean>(STORAGE_KEYS.animationsEnabled);
  return value ?? true;
}

export async function setAnimationsEnabled(value: boolean): Promise<void> {
  await storage.setItem(STORAGE_KEYS.animationsEnabled, value);
}

export async function getTheme(): Promise<Theme> {
  const value = await storage.getItem<Theme>(STORAGE_KEYS.theme);
  return value ?? DEFAULT_THEME;
}

export async function setTheme(value: Theme): Promise<void> {
  if (value !== 'light' && value !== 'dark') {
    throw new Error('Theme must be either "light" or "dark"');
  }
  await storage.setItem(STORAGE_KEYS.theme, value);
}

export async function getResetEditorOnEveryProblem(): Promise<boolean> {
  const value = await storage.getItem<boolean>(STORAGE_KEYS.resetEditorOnEveryProblem);
  return value ?? DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM;
}

export async function setResetEditorOnEveryProblem(value: boolean): Promise<void> {
  await storage.setItem(STORAGE_KEYS.resetEditorOnEveryProblem, value);
}

export async function getResetEditorOnDueReview(): Promise<boolean> {
  const value = await storage.getItem<boolean>(STORAGE_KEYS.resetEditorOnDueReview);
  return value ?? DEFAULT_RESET_EDITOR_ON_DUE_REVIEW;
}

export async function setResetEditorOnDueReview(value: boolean): Promise<void> {
  await storage.setItem(STORAGE_KEYS.resetEditorOnDueReview, value);
}

export async function getBadgeEnabled(): Promise<boolean> {
  const value = await storage.getItem<boolean>(STORAGE_KEYS.badgeEnabled);
  return value ?? DEFAULT_BADGE_ENABLED;
}

export async function setBadgeEnabled(value: boolean): Promise<void> {
  await storage.setItem(STORAGE_KEYS.badgeEnabled, value);
}

export async function getLanguage(): Promise<Language> {
  const value = await storage.getItem<Language>(STORAGE_KEYS.language);
  return value && value in translations ? value : detectBrowserLanguage();
}

export async function setLanguage(value: Language): Promise<void> {
  if (!(value in translations)) {
    throw new Error(`Unsupported language: ${value}. Supported languages: ${Object.keys(translations).join(', ')}`);
  }
  await storage.setItem(STORAGE_KEYS.language, value);
}
