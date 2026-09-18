import type { ComponentType } from 'react';
import type { ViewId } from '@/popup/components/BottomNav';
import { ReleaseAnnouncement } from './ReleaseAnnouncement';

export interface PopupDialogContentProps {
  onDismiss: () => void;
  onNavigate: (view: ViewId) => void;
}

export interface PopupDialogEntry {
  id: string;
  loadEligibility: () => Promise<boolean>;
  Content: ComponentType<PopupDialogContentProps>;
}

// Array order is display order. Replace the release entry for each new announcement.
export const popupDialogRegistry: readonly PopupDialogEntry[] = [
  {
    id: 'release-1.0',
    loadEligibility: async () => true,
    Content: ReleaseAnnouncement,
  },
];

export const dialogEligibilityQueryKey = (id: string) => ['popupDialogs', 'eligibility', id] as const;
