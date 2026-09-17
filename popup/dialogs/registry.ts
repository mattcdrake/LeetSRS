import type { ComponentType } from 'react';

export interface PopupDialogContentProps {
  onDismiss: () => void;
}

export interface PopupDialogEntry {
  id: string;
  loadEligibility: () => Promise<boolean>;
  Content: ComponentType<PopupDialogContentProps>;
}

// Array order is display order. Entries are added when their dialogs adopt the host.
export const popupDialogRegistry: readonly PopupDialogEntry[] = [];

export const dialogEligibilityQueryKey = (id: string) => ['popupDialogs', 'eligibility', id] as const;
