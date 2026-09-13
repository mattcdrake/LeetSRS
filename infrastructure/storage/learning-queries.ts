import type { State as FsrsState } from 'ts-fsrs';
import { formatLocalDate } from '@/domain/calendar';
import type { Card, LeetcodeDomain } from '@/domain/cards';
import { findCard } from '@/domain/learning-document';
import { buildReviewQueue, isDue, shouldResetCardEditor } from '@/domain/review';
import { resolveSettings, type Settings } from '@/domain/settings';
import {
  calculateHistoryStats,
  calculateUpcomingStats,
  countCardStates,
  type DailyStats,
  type UpcomingReviewStats,
} from '@/domain/statistics';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { readLearningDocument } from './learning-document';

export async function getAllCards(): Promise<Card[]> {
  return Object.values((await readLearningDocument()).cards);
}

export async function getTodayStats(): Promise<DailyStats | null> {
  const now = new Date();
  const document = await readLearningDocument();
  return document.stats[formatLocalDate(now)] ?? null;
}

export async function getCardStateStats(): Promise<Record<FsrsState, number>> {
  const document = await readLearningDocument();
  return countCardStates(Object.values(document.cards));
}

export async function getLastNDaysStats(days: number): Promise<DailyStats[]> {
  const now = new Date();
  const document = await readLearningDocument();
  return calculateHistoryStats(document.stats, days, now);
}

export async function getNextNDaysStats(days: number): Promise<UpcomingReviewStats[]> {
  const now = new Date();
  const document = await readLearningDocument();
  return calculateUpcomingStats(Object.values(document.cards), days, now);
}

export async function getReviewQueue(): Promise<Card[]> {
  const now = new Date();
  const document = await readLearningDocument();
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  const dueCards = Object.values(document.cards).filter((card) => !card.paused && isDue(card, now));
  const newCardsCompletedToday = document.stats[formatLocalDate(now)]?.newCards ?? 0;
  return buildReviewQueue(dueCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}

export async function shouldResetEditor(slug: string, domain: LeetcodeDomain): Promise<boolean> {
  const now = new Date();
  const document = await readLearningDocument();
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  return shouldResetCardEditor(findCard(document, slug), domain, settings, now);
}

export async function getNote(slug: string): Promise<string | null> {
  const document = await readLearningDocument();
  return findCard(document, slug)?.note ?? null;
}

export async function getSettings(): Promise<Settings> {
  const document = await readLearningDocument();

  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}

export async function exportData(): Promise<string> {
  const document = await readLearningDocument();

  return JSON.stringify(document, null, 2);
}
