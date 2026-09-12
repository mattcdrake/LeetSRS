import { z } from 'zod';

export const gistSyncConfigSchema = z.object({
  pat: z.string(),
  gistId: z.string().nullable(),
  enabled: z.boolean(),
});
export type GistSyncConfig = z.infer<typeof gistSyncConfigSchema>;

export const gistSyncConfigUpdateSchema = gistSyncConfigSchema.partial();
export type GistSyncConfigUpdate = z.infer<typeof gistSyncConfigUpdateSchema>;

export interface GistSyncStatus {
  lastSyncTime: string | null;
  lastSyncDirection: 'push' | 'pull' | null;
  syncInProgress: boolean;
  lastError: string | null;
}

export interface GistValidationResult {
  valid: boolean;
  error?: string;
}

export type SyncResult =
  | { success: true; action: 'pushed' | 'pulled' | 'no-change'; timestamp: string }
  | { success: false; error: string };

export interface PatValidationResult {
  valid: boolean;
  username?: string;
  error?: string;
}

export type RemoteGistContent = { state: 'missing' } | { state: 'parsed'; dataUpdatedAt?: string | null };

export type GistSyncDecision = { action: 'push' | 'pull' | 'no-change' };

export function decideGistSync(
  remote: RemoteGistContent,
  localDataUpdatedAt: string | null | undefined
): GistSyncDecision {
  if (remote.state !== 'parsed') {
    return { action: 'push' };
  }

  if (!remote.dataUpdatedAt) {
    return { action: 'push' };
  }

  if (!localDataUpdatedAt) {
    return { action: 'pull' };
  }

  const localUpdated = new Date(localDataUpdatedAt);
  const remoteUpdated = new Date(remote.dataUpdatedAt);
  if (localUpdated < remoteUpdated) {
    return { action: 'pull' };
  }
  if (localUpdated > remoteUpdated) {
    return { action: 'push' };
  }

  // Preserve existing comparisons: invalid dates, like equal dates, fall through.
  return { action: 'no-change' };
}
