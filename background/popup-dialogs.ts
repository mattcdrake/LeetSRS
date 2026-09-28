import { storage } from '#imports';
import { readPopupDialogAcknowledgments, writePopupDialogAcknowledgments } from '@/shared/popup-dialogs';
import { type RatingCtaResolution, writeRatingCtaResolution } from '@/shared/rating-cta';

const ratingHintShownItem = storage.defineItem<boolean>('local:leetsrs:ratingHintShown', { fallback: false });

export async function acknowledgePopupDialog(id: string): Promise<void> {
  const acknowledgments = await readPopupDialogAcknowledgments();
  await writePopupDialogAcknowledgments({ ...acknowledgments, [id]: true });
}

export async function resolveRatingCta(outcome: RatingCtaResolution['outcome'], dialogId: string): Promise<void> {
  await writeRatingCtaResolution({ outcome, dialogId });
}

export async function shouldShowAutoOpenHint(): Promise<boolean> {
  return !(await ratingHintShownItem.getValue());
}

export async function markAutoOpenHintShown(): Promise<void> {
  await ratingHintShownItem.setValue(true);
}
