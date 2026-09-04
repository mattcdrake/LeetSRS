import { Octokit } from 'octokit';
import { storage } from '#imports';
import type {
  GistSyncConfig,
  GistSyncStatus,
  GistValidationResult,
  PatValidationResult,
  SyncResult,
} from '@/shared/gist-sync';
import { getServiceTranslations } from './i18n';
import type { ExportData } from './import-export';
import { exportData, importData } from './import-export';
import { STORAGE_KEYS } from './storage-keys';

const GIST_FILENAME = 'leetsrs-backup.json';

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
    description: (await getServiceTranslations()).settings.gistSync.gistDescription,
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

  await setGistSyncConfig({ gistId });

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

    if (!config.pat) {
      return { success: false, error: 'PAT is not configured' };
    }

    if (!config.gistId) {
      return { success: false, error: 'Gist ID is not configured' };
    }

    const octokit = new Octokit({ auth: config.pat });

    let remoteGist: Awaited<ReturnType<typeof octokit.rest.gists.get>>['data'];
    try {
      const { data } = await octokit.rest.gists.get({ gist_id: config.gistId });
      remoteGist = data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return { success: false, error: 'Gist not found' };
      }
      throw error;
    }

    const remoteFileContent = remoteGist.files?.[GIST_FILENAME]?.content;
    if (!remoteFileContent) {
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    let remoteData: ExportData;
    try {
      remoteData = JSON.parse(remoteFileContent);
    } catch {
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    const localDataUpdatedAt = await storage.getItem<string>(STORAGE_KEYS.dataUpdatedAt);

    // Handle missing dataUpdatedAt (legacy or fresh install)
    if (!localDataUpdatedAt && remoteData.dataUpdatedAt) {
      return await pullFromGist(remoteFileContent);
    }
    if (!remoteData.dataUpdatedAt) {
      if (!localDataUpdatedAt) {
        await storage.setItem(STORAGE_KEYS.dataUpdatedAt, new Date().toISOString());
      }
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    if (!localDataUpdatedAt) {
      throw new Error('Local data update timestamp is missing');
    }
    const localUpdated = new Date(localDataUpdatedAt);
    const remoteUpdated = new Date(remoteData.dataUpdatedAt);

    if (localUpdated < remoteUpdated) {
      return await pullFromGist(remoteFileContent);
    }

    if (localUpdated > remoteUpdated) {
      const localExportJson = await exportData();
      return await pushToGist(octokit, config.gistId, localExportJson);
    }

    const now = new Date().toISOString();
    await storage.setItem(STORAGE_KEYS.lastSyncTime, now);
    return { success: true, action: 'no-change', timestamp: now };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    lastError = errorMessage;

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
