import { formatLocalDate } from '@/domain/calendar';
import type { Card } from '@/domain/cards';
import type { LearningDocument } from '@/domain/learning-document';
import { buildReviewQueue, isDue } from '@/domain/review';
import { DEFAULT_SETTINGS, resolveSettings, type Settings } from '@/domain/settings';
import { detectBrowserLanguage } from '@/integrations/browser/language';
import { readLearningDocument } from './learning-document';

export async function getReviewQueue(waitForInitialization = false): Promise<Card[]> {
  const now = new Date();
  const document = await readLearningDocument(waitForInitialization);
  return reviewQueue(document, now);
}

function reviewQueue(document: LearningDocument, now: Date): Card[] {
  const settings = resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
  const dueCards = Object.values(document.cards).filter((card) => !card.paused && isDue(card, now));
  const newCardsCompletedToday = document.stats[formatLocalDate(now)]?.newCards ?? 0;
  return buildReviewQueue(dueCards, settings.maxNewCardsPerDay, newCardsCompletedToday);
}

export async function getBadgeState(): Promise<{ count: number; nextDueAt?: number }> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!(document.settings.badgeEnabled ?? DEFAULT_SETTINGS.badgeEnabled)) return { count: 0 };
  const nextDueAt = Object.values(document.cards).reduce(
    (next, card) => (!card.paused && card.fsrs.due > now.getTime() ? Math.min(next, card.fsrs.due) : next),
    Infinity
  );
  return { count: reviewQueue(document, now).length, nextDueAt: Number.isFinite(nextDueAt) ? nextDueAt : undefined };
}

export async function getSettings(waitForInitialization = false): Promise<Settings> {
  const document = await readLearningDocument(waitForInitialization);
  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}
