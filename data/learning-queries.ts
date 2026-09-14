import type { Card } from '@/domain/cards';
import type { LearningDocument } from '@/domain/learning-document';
import { buildReviewQueue } from '@/domain/review';
import { DEFAULT_SETTINGS, resolveSettings, type Settings } from '@/domain/settings';
import { detectBrowserLanguage } from '@/integrations/browser/language';
import { readLearningDocument } from './learning-document';

export async function getReviewQueue(waitForInitialization = false): Promise<Card[]> {
  const now = new Date();
  const document = await readLearningDocument(waitForInitialization);
  return buildReviewQueue(document, now);
}

export async function getBadgeState(): Promise<{ count: number; nextDueAt?: number }> {
  const now = new Date();
  const document = await readLearningDocument();
  if (!(document.settings.badgeEnabled ?? DEFAULT_SETTINGS.badgeEnabled)) return { count: 0 };
  const nextDueAt = Object.values(document.cards).reduce(
    (next, card) => (!card.paused && card.fsrs.due > now.getTime() ? Math.min(next, card.fsrs.due) : next),
    Infinity
  );
  return {
    count: buildReviewQueue(document, now).length,
    nextDueAt: Number.isFinite(nextDueAt) ? nextDueAt : undefined,
  };
}

export async function getSettings(waitForInitialization = false): Promise<Settings> {
  const document = await readLearningDocument(waitForInitialization);
  return resolveLearningDocumentSettings(document);
}

export function resolveLearningDocumentSettings(document: LearningDocument): Settings {
  return resolveSettings(document.settings, document.settings.language ?? detectBrowserLanguage());
}
