import { readPopupDialogAcknowledgments, writePopupDialogAcknowledgments } from '@/shared/storage';

export async function acknowledgePopupDialog(id: string): Promise<void> {
  const acknowledgments = await readPopupDialogAcknowledgments();
  await writePopupDialogAcknowledgments({ ...acknowledgments, [id]: true });
}
