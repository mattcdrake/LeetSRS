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

export type SyncResult =
  | { success: true; action: 'pushed' | 'pulled' | 'no-change'; timestamp: string }
  | { success: false; error: string };

export interface PatValidationResult {
  valid: boolean;
  username?: string;
  error?: string;
}

export interface GistValidationResult {
  valid: boolean;
  error?: string;
}
