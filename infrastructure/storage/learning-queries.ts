import { formatLocalDate } from '@/domain/calendar';
import type { Card } from '@/domain/cards';
import { buildReviewQueue, isDue } from '@/domain/review';
import { resolveSettings, type Settings } from '@/domain/settings';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { readLearningDocument } from './learning-document';

export async function getReviewQueue(waitForInitialization = false): Promise<Card[]> {
  const now = new Date();
  const document = await readLearningDocument(waitForInitialization);
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  const dueCards = Object.values(document.cards).filter((card) => !card.paused && isDue(card, now));
  const newCardsCompletedToday = document.stats[formatLocalDate(now)]?.newCards ?? 0;
  return buildReviewQueue(dueCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}

export async function getSettings(waitForInitialization = false): Promise<Settings> {
  const document = await readLearningDocument(waitForInitialization);
  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}
