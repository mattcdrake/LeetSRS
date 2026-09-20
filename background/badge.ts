import { browser } from 'wxt/browser';
import { addLocalDays } from '@/shared/calendar';
import { buildReviewQueue } from '@/shared/review';
import { readLearningDocument } from '@/shared/storage';

export async function getBadgeState(): Promise<{ count: number; nextRefreshAt?: number }> {
  const now = new Date();
  const document = await readLearningDocument();
  const hasActiveCards = Object.values(document.cards).some((card) => !card.paused);
  return {
    count: buildReviewQueue(document, now).length,
    nextRefreshAt: hasActiveCards ? addLocalDays(now, 1).getTime() : undefined,
  };
}

export const BADGE_ALARM_NAME = 'badge-refresh';

export async function refreshBadge() {
  try {
    const { count, nextRefreshAt } = await getBadgeState();
    const alarm = await browser.alarms.get(BADGE_ALARM_NAME);
    if (nextRefreshAt === undefined) await browser.alarms.clear(BADGE_ALARM_NAME);
    else if (alarm?.scheduledTime !== nextRefreshAt)
      await browser.alarms.create(BADGE_ALARM_NAME, { when: nextRefreshAt });
    await browser.action.setBadgeText({ text: count ? String(count) : '' });
    if (count) await browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } catch (error) {
    console.warn('Failed to refresh badge:', error);
  }
}
