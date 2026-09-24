import { storage } from '#imports';
import { readPopupDialogAcknowledgments, writePopupDialogAcknowledgments } from '@/shared/storage';

export async function acknowledgePopupDialog(id: string): Promise<void> {
  const acknowledgments = await readPopupDialogAcknowledgments();
  await writePopupDialogAcknowledgments({ ...acknowledgments, [id]: true });
}

export async function shouldShowAutoOpenHint(): Promise<boolean> {
  return !(await storage.getItem('local:leetsrs:ratingHintShown'));
}

export async function markAutoOpenHintShown(): Promise<void> {
  await storage.setItem('local:leetsrs:ratingHintShown', true);
}
