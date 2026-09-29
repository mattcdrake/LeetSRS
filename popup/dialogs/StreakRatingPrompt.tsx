import { Button, Heading } from 'react-aria-components';
import { LuArrowUpRight, LuFlame, LuStar, LuX } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction, iconButton, primaryButton } from '@/popup/styles';
import { background } from '@/shared/background-service';
import { formatLocalDate } from '@/shared/calendar';
import { readLearningDocument } from '@/shared/learning-document';
import { type RatingCtaResolution, readRatingCtaResolution, reviewStore } from '@/shared/rating-cta';
import { buildReviewQueue } from '@/shared/review';
import type { PopupDialogContentProps } from './registry';

export const STREAK_RATING_DIALOG_ID = 'rating-streak-7';
const STREAK_DAYS = 7;

// Ask once the user has cleared today's queue on a week-long streak, while the win is fresh.
export async function loadStreakRatingEligibility(): Promise<boolean> {
  if (!reviewStore || (await readRatingCtaResolution())) return false;
  const document = await readLearningDocument();
  const now = new Date();
  const activity = document.reviewActivity;
  return (
    activity?.date === formatLocalDate(now) &&
    activity.streak >= STREAK_DAYS &&
    buildReviewQueue(document, now).length === 0
  );
}

export function StreakRatingPrompt({ onDismiss }: PopupDialogContentProps) {
  const t = useI18n().ratingPrompt;
  if (!reviewStore) return null;
  const store = reviewStore;

  const resolve = (outcome: RatingCtaResolution['outcome']) => {
    // Dispatch directly: opening the store tab can close the popup before a mutation settles.
    void background.resolveRatingCta(outcome, STREAK_RATING_DIALOG_ID).catch((error) => {
      console.warn('Failed to save rating prompt response:', error);
    });
    onDismiss();
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-1 text-center">
      <Button aria-label={t.dismiss} className={`absolute top-2 right-2 ${iconButton}`} onPress={onDismiss}>
        <LuX aria-hidden="true" className="size-4" />
      </Button>
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-2xl bg-[var(--ls-warning-soft)] text-warning"
      >
        <LuFlame className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <Heading slot="title" className="text-hero font-semibold">
          {t.title}
        </Heading>
        <p className="text-body text-secondary">{t.body}</p>
      </div>
      <div aria-hidden="true" className="flex gap-1 text-warning">
        {[1, 2, 3, 4, 5].map((star) => (
          <LuStar key={star} className="size-4 fill-current" />
        ))}
      </div>
      <div className="flex w-full flex-col gap-1">
        <a
          href={store.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full ${primaryButton}`}
          onClick={() => resolve('rated')}
        >
          {t.rateOn(store.name)}
          <LuArrowUpRight aria-hidden="true" className="size-4" />
        </a>
        <Button
          className={`h-8 rounded-md text-xs font-medium text-secondary duration-[120ms] hover:bg-secondary ${buttonInteraction}`}
          onPress={() => resolve('declined')}
        >
          {t.noThanks}
        </Button>
      </div>
    </div>
  );
}
