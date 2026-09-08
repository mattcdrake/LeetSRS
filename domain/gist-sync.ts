export interface GistSyncConfig {
  pat: string;
  gistId: string | null;
  enabled: boolean;
}

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

export type RemoteGistContent =
  | { state: 'missing' | 'invalid-json' }
  | { state: 'parsed'; dataUpdatedAt?: string | null };

export type GistSyncDecision =
  | { action: 'push'; initializeDataUpdatedAt: boolean }
  | { action: 'pull' | 'no-change'; initializeDataUpdatedAt: false };

export function decideGistSync(
  remote: RemoteGistContent,
  localDataUpdatedAt: string | null | undefined
): GistSyncDecision {
  if (remote.state !== 'parsed') {
    return { action: 'push', initializeDataUpdatedAt: false };
  }

  if (!remote.dataUpdatedAt) {
    return { action: 'push', initializeDataUpdatedAt: !localDataUpdatedAt };
  }

  if (!localDataUpdatedAt) {
    return { action: 'pull', initializeDataUpdatedAt: false };
  }

  const localUpdated = new Date(localDataUpdatedAt);
  const remoteUpdated = new Date(remote.dataUpdatedAt);
  if (localUpdated < remoteUpdated) {
    return { action: 'pull', initializeDataUpdatedAt: false };
  }
  if (localUpdated > remoteUpdated) {
    return { action: 'push', initializeDataUpdatedAt: false };
  }

  // Preserve existing comparisons: invalid dates, like equal dates, fall through.
  return { action: 'no-change', initializeDataUpdatedAt: false };
}
