import type { ComponentType } from 'react';
import { GithubMigrationNotice } from '@/popup/legacy/GithubMigrationNotice';
import { background } from '@/shared/background-service';
import { ReleaseAnnouncement } from './ReleaseAnnouncement';

export interface PopupDialogContentProps {
  onDismiss: () => void;
  onOpenSettings?: () => void;
}

export interface PopupDialogEntry {
  id: string;
  loadEligibility: () => Promise<boolean>;
  Content: ComponentType<PopupDialogContentProps>;
}

// Array order is display order. Replace the release entry for each new announcement.
export const popupDialogRegistry: readonly PopupDialogEntry[] = [
  {
    id: 'github-migration',
    loadEligibility: async () => (await background.getGithubAuthStatus()).migrationNotice,
    Content: GithubMigrationNotice,
  },
  {
    id: 'release-1.0',
    loadEligibility: async () => true,
    Content: ReleaseAnnouncement,
  },
];

export const dialogEligibilityQueryKey = (id: string) => ['popupDialogs', 'eligibility', id] as const;
