import { storage } from '#imports';
import { readPopupDialogAcknowledgments, writePopupDialogAcknowledgments } from '@/shared/popup-dialogs';

const ratingHintShownItem = storage.defineItem<boolean>('local:leetsrs:ratingHintShown', { fallback: false });

export async function acknowledgePopupDialog(id: string): Promise<void> {
  const acknowledgments = await readPopupDialogAcknowledgments();
  await writePopupDialogAcknowledgments({ ...acknowledgments, [id]: true });
}

export async function shouldShowAutoOpenHint(): Promise<boolean> {
  return !(await ratingHintShownItem.getValue());
}

export async function markAutoOpenHintShown(): Promise<void> {
  await ratingHintShownItem.setValue(true);
}
