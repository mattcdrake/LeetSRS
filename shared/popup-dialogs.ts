import { z } from 'zod';
import { storage } from '#imports';

export const popupDialogAcknowledgmentsItem = storage.defineItem<unknown>('local:leetsrs:popupDialogAcknowledgments');

const popupDialogAcknowledgmentsSchema = z.record(z.string(), z.literal(true));
export type PopupDialogAcknowledgments = z.infer<typeof popupDialogAcknowledgmentsSchema>;

export async function readPopupDialogAcknowledgments(): Promise<PopupDialogAcknowledgments> {
  const stored = await popupDialogAcknowledgmentsItem.getValue();
  return popupDialogAcknowledgmentsSchema.parse(stored ?? {});
}

export function writePopupDialogAcknowledgments(acknowledgments: PopupDialogAcknowledgments): Promise<void> {
  return popupDialogAcknowledgmentsItem.setValue(popupDialogAcknowledgmentsSchema.parse(acknowledgments));
}
