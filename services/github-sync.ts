import { Octokit } from 'octokit';
import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';
import { exportData, importData } from './import-export';
import type { ExportData } from './import-export';
import type {
  GistSyncConfig,
  GistSyncStatus,
  SyncResult,
  PatValidationResult,
  GistValidationResult,
} from '@/shared/gist-sync';
import { i18n } from '@/shared/i18n';

const GIST_FILENAME = 'leetsrs-backup.json';

// In-memory state for sync status (not persisted)
let syncInProgress = false;
let lastError: string | null = null;

export async function getGistSyncConfig(): Promise<GistSyncConfig> {
  const pat = (await storage.getItem<string>(STORAGE_KEYS.githubPat)) ?? '';
  const gistId = (await storage.getItem<string>(STORAGE_KEYS.gistId)) ?? null;
  const enabled = (await storage.getItem<boolean>(STORAGE_KEYS.gistSyncEnabled)) ?? false;
  return { pat, gistId, enabled };
}

export async function setGistSyncConfig(config: Partial<GistSyncConfig>): Promise<void> {
  if (config.pat !== undefined) {
    await storage.setItem(STORAGE_KEYS.githubPat, config.pat);
  }
  if (config.gistId !== undefined) {
    if (config.gistId === null) {
      await storage.removeItem(STORAGE_KEYS.gistId);
    } else {
      await storage.setItem(STORAGE_KEYS.gistId, config.gistId);
    }
  }
  if (config.enabled !== undefined) {
    await storage.setItem(STORAGE_KEYS.gistSyncEnabled, config.enabled);
  }
}

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  const lastSyncTime = (await storage.getItem<string>(STORAGE_KEYS.lastSyncTime)) ?? null;
  const lastSyncDirection = (await storage.getItem<'push' | 'pull'>(STORAGE_KEYS.lastSyncDirection)) ?? null;
  return {
    lastSyncTime,
    lastSyncDirection,
    syncInProgress,
    lastError,
  };
}

export async function validatePat(pat: string): Promise<PatValidationResult> {
  if (!pat.trim()) {
    return { valid: false, error: 'PAT is required' };
  }

  try {
    const octokit = new Octokit({ auth: pat });
    const { data } = await octokit.rest.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return { valid: false, error: 'Invalid token' };
      }
      if (error.message.includes('403')) {
        return { valid: false, error: 'Token lacks required permissions (needs gist scope)' };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error validating token' };
  }
}

export async function validateGistId(gistId: string, pat: string): Promise<GistValidationResult> {
  if (!gistId.trim()) {
    return { valid: false, error: 'Gist ID is required' };
  }

  try {
    const octokit = new Octokit({ auth: pat });
    const { data } = await octokit.rest.gists.get({ gist_id: gistId });

    // Check if the gist has our file
    if (!data.files?.[GIST_FILENAME]) {
      return { valid: false, error: `Gist does not contain ${GIST_FILENAME}` };
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        return { valid: false, error: 'Gist not found' };
      }
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error validating Gist ID' };
  }
}

export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await getGistSyncConfig();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const octokit = new Octokit({ auth: config.pat });
  const exportJson = await exportData();

  const { data } = await octokit.rest.gists.create({
    description: i18n.settings.gistSync.gistDescription,
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: exportJson,
      },
    },
  });

  if (!data.id) {
    throw new Error('Failed to create gist: no ID returned');
  }

  const gistId = data.id;

  // Save the new gist ID
  await setGistSyncConfig({ gistId });

  // Update sync status
  const now = new Date().toISOString();
  await storage.setItem(STORAGE_KEYS.lastSyncTime, now);
  await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');

  return { gistId };
}

export async function triggerGistSync(): Promise<SyncResult> {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }

  syncInProgress = true;
  lastError = null;

  try {
    const config = await getGistSyncConfig();

    if (!config.enabled) {
      return { success: false, error: 'Sync is not enabled' };
    }

    if (!config.pat) {
      return { success: false, error: 'PAT is not configured' };
    }

    if (!config.gistId) {
      return { success: false, error: 'Gist ID is not configured' };
    }

    const octokit = new Octokit({ auth: config.pat });

    // Fetch remote gist
    let remoteGist;
    try {
      const { data } = await octokit.rest.gists.get({ gist_id: config.gistId });
      remoteGist = data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return { success: false, error: 'Gist not found' };
      }
      throw error;
    }

    // Get remote data
    const remoteFileContent = remoteGist.files?.[GIST_FILENAME]?.content;
    if (!remoteFileContent) {
      // Remote gist exists but doesn't have our file - push local data
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    let remoteData: ExportData;
    try {
      remoteData = JSON.parse(remoteFileContent);
    } catch {
      // Invalid JSON in remote - push local
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    // Compare remote's exportDate against our lastSyncTime
    // If remote is newer than our last sync, another device pushed - pull
    // Otherwise, push our current state
    const lastSyncTime = (await storage.getItem<string>(STORAGE_KEYS.lastSyncTime)) ?? null;
    const remoteDate = new Date(remoteData.exportDate);

    if (lastSyncTime && remoteDate > new Date(lastSyncTime)) {
      // Remote was updated since our last sync - pull
      return await pullFromGist(remoteFileContent);
    } else {
      // Push our current state
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    lastError = errorMessage;

    // Handle rate limiting
    if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
      return { success: false, error: 'GitHub API rate limit exceeded. Please try again later.' };
    }

    return { success: false, error: errorMessage };
  } finally {
    syncInProgress = false;
  }
}

async function pushToGist(octokit: Octokit, gistId: string, content: string): Promise<SyncResult> {
  await octokit.rest.gists.update({
    gist_id: gistId,
    files: {
      [GIST_FILENAME]: {
        content,
      },
    },
  });

  const now = new Date().toISOString();
  await storage.setItem(STORAGE_KEYS.lastSyncTime, now);
  await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'push');

  return { success: true, action: 'pushed', timestamp: now };
}

async function pullFromGist(content: string): Promise<SyncResult> {
  await importData(content);

  const now = new Date().toISOString();
  await storage.setItem(STORAGE_KEYS.lastSyncTime, now);
  await storage.setItem(STORAGE_KEYS.lastSyncDirection, 'pull');

  return { success: true, action: 'pulled', timestamp: now };
}
