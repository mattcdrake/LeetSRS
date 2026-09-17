import { readPopupDialogAcknowledgments, writePopupDialogAcknowledgments } from '@/shared/storage';

let pendingAcknowledgment = Promise.resolve();

export function acknowledgePopupDialog(id: string): Promise<void> {
  // Popups in different windows must not overwrite each other's acknowledgments.
  const save = pendingAcknowledgment.then(async () => {
    const acknowledgments = await readPopupDialogAcknowledgments();
    if (acknowledgments[id] === true) return;
    await writePopupDialogAcknowledgments({ ...acknowledgments, [id]: true });
  });
  pendingAcknowledgment = save.catch(() => {});
  return save;
}
