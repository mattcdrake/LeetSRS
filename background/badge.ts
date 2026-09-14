import { browser } from 'wxt/browser';
import { buildReviewQueue } from '@/shared/review';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { readLearningDocument } from '@/shared/storage';

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

export const BADGE_ALARM_NAME = 'badge-refresh';

export async function refreshBadge() {
  try {
    const { count, nextDueAt } = await getBadgeState();
    const alarm = await browser.alarms.get(BADGE_ALARM_NAME);
    if (nextDueAt === undefined) await browser.alarms.clear(BADGE_ALARM_NAME);
    else if (alarm?.scheduledTime !== nextDueAt) await browser.alarms.create(BADGE_ALARM_NAME, { when: nextDueAt });
    await browser.action.setBadgeText({ text: count ? String(count) : '' });
    if (count) await browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } catch (error) {
    console.warn('Failed to refresh badge:', error);
  }
}
