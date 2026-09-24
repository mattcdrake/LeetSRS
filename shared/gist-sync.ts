import { z } from 'zod';
import { storage } from '#imports';
import { LEGACY_PAT_KEYS } from '@/shared/legacy/github-pat';

export const githubAuthorizationItem = storage.defineItem<unknown>('local:leetsrs:githubAuthorization');
export const githubSetupPendingItem = storage.defineItem<boolean>('local:leetsrs:githubSetupPending', {
  fallback: false,
});

export const GITHUB_HOST_PERMISSIONS = {
  origins: ['https://auth.leetsrs.com/*', 'https://api.github.com/*', 'https://gist.githubusercontent.com/*'],
};

export interface GithubAuthStatus {
  account: { id: number; login: string } | null;
  signingIn: boolean;
  error: 'signInFailed' | null;
  migrationNotice: boolean;
  setupPending: boolean;
}

export interface GistDestination {
  id: string;
  description: string;
  updatedAt: string;
  suggested: boolean;
}

export const gistSyncConfigSchema = z.union([
  z.object({ accountId: z.null(), gistId: z.null(), enabled: z.literal(false) }),
  z.object({
    accountId: z.number().int().positive(),
    gistId: z.string().refine((id) => id.trim().length > 0),
    enabled: z.boolean(),
  }),
]);
export type GistSyncConfig = z.infer<typeof gistSyncConfigSchema>;

export const gistSetupSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('existing'), gistId: z.string().trim().min(1) }),
  z.object({ mode: z.literal('create') }),
]);
export type GistSetup = z.infer<typeof gistSetupSchema>;

export type GistSyncErrorCode =
  | 'authentication'
  | 'connectionSaveFailed'
  | 'creationFailed'
  | 'gistNotFound'
  | 'missingBackup'
  | 'missingToken'
  | 'rateLimit'
  | 'unavailable'
  | 'unknown';

export type GistConnectionResult = { saved: true } | { saved: false; error: GistSyncErrorCode };

export interface GistSyncStatus {
  lastSyncTime: string | null;
  syncInProgress: boolean;
  lastError: GistSyncErrorCode | null;
}

export const gistConnectionItem = storage.defineItem<GistSyncConfig>('local:leetsrs:gistConnection');

// Sync status is separate from the learning document and its edit timestamp.
export const lastSyncTimeItem = storage.defineItem<string>('local:leetsrs:lastSyncTime');

export function removeSyncStatus(): Promise<void> {
  // Clear the retired direction key during reset and sign-out.
  return storage.removeItems([lastSyncTimeItem, 'local:leetsrs:lastSyncDirection']);
}

export async function readGistConnection(): Promise<GistSyncConfig> {
  const connection = await gistConnectionItem.getValue();

  return gistSyncConfigSchema.parse(connection ?? { accountId: null, gistId: null, enabled: false });
}

export function writeGistConnection(config: GistSyncConfig): Promise<void> {
  return gistConnectionItem.setValue(gistSyncConfigSchema.parse(config));
}

export function removeGistConnection(): Promise<void> {
  // Retained legacy keys must also be cleared so reset reaches older browsers.
  return storage.removeItems([gistConnectionItem, ...LEGACY_PAT_KEYS]);
}
