import {
  decideGistSync,
  type GistSyncConfigUpdate,
  type GistSyncDecision,
  type GistSyncStatus,
  type GistValidationResult,
  gistSyncConfigUpdateSchema,
  type SyncResult,
} from '@/domain/gist-sync';
import { createGitHubClient, GIST_FILENAME, type GitHubClient } from '@/infrastructure/github/client';
import type { ExportData } from '@/infrastructure/storage/backup';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { readSyncMetadata, writeSyncMetadata, writeSyncStatus } from '@/infrastructure/storage/sync-metadata';
import { getStoredTranslations } from '@/infrastructure/storage/translations';
import { exportData, importData } from './import-export';

// In-memory state for sync status (not persisted)
let syncInProgress = false;
let lastError: string | null = null;

export async function setGistSyncConfig(config: GistSyncConfigUpdate): Promise<void> {
  const parsed = gistSyncConfigUpdateSchema.parse(config);
  const changes = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length === 0) return;
  await writeGistConnection({ ...(await readGistConnection()), ...changes });
}

export async function validateGistId(gistId: string, pat: string): Promise<GistValidationResult> {
  if (!gistId.trim()) {
    return { valid: false, error: 'Gist ID is required' };
  }

  try {
    const github = createGitHubClient(pat);
    return await validateGist(gistId, github);
  } catch (error) {
    return gistValidationError(error);
  }
}

async function validateGist(gistId: string, github: GitHubClient): Promise<GistValidationResult> {
  if (!gistId.trim()) return { valid: false, error: 'Gist ID is required' };

  try {
    const { data } = await github.getGist(gistId);

    if (!data.files?.[GIST_FILENAME]) {
      return { valid: false, error: `Gist does not contain ${GIST_FILENAME}` };
    }

    return { valid: true };
  } catch (error) {
    return gistValidationError(error);
  }
}

function gistValidationError(error: unknown): GistValidationResult {
  if (!(error instanceof Error)) return { valid: false, error: 'Unknown error validating Gist ID' };
  if (error.message.includes('404')) return { valid: false, error: 'Gist not found' };
  return { valid: false, error: error.message };
}

export async function createNewGist(): Promise<{ gistId: string }> {
  const config = await readGistConnection();
  if (!config.pat) {
    throw new Error('PAT is required to create a gist');
  }

  const github = createGitHubClient(config.pat);
  const exportJson = await exportData();

  return createGistFromBackup(github, exportJson, (await getStoredTranslations()).settings.gistSync.gistDescription);
}

// Shared by the legacy and prepared document consumers until #379 removes the former.
export async function createGistFromBackup(
  github: GitHubClient,
  exportJson: string,
  description: string
): Promise<{ gistId: string }> {
  const { data } = await github.createGist(description, exportJson);

  if (!data.id) {
    throw new Error('Failed to create gist: no ID returned');
  }

  const gistId = data.id;

  await setGistSyncConfig({ gistId });

  const now = new Date().toISOString();
  await writeSyncStatus({ lastSyncTime: now, lastSyncDirection: 'push' });

  return { gistId };
}

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  const lastSyncTime = (await readSyncMetadata('lastSyncTime')) ?? null;
  const lastSyncDirection = (await readSyncMetadata('lastSyncDirection')) ?? null;
  return {
    lastSyncTime,
    lastSyncDirection,
    syncInProgress,
    lastError,
  };
}

export async function triggerGistSync(): Promise<SyncResult> {
  syncInProgress = true;
  lastError = null;

  try {
    const config = await readGistConnection();

    if (!config.pat) {
      return { success: false, error: 'PAT is not configured' };
    }

    if (!config.gistId) {
      return { success: false, error: 'Gist ID is not configured' };
    }

    const github = createGitHubClient(config.pat);

    let remoteGist: Awaited<ReturnType<typeof github.getGist>>['data'];
    try {
      const { data } = await github.getGist(config.gistId);
      remoteGist = data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return { success: false, error: 'Gist not found' };
      }
      throw error;
    }

    const remoteFileContent = remoteGist.files?.[GIST_FILENAME]?.content ?? '';
    const decision = await getSyncDecision(remoteFileContent);

    if (decision.initializeDataUpdatedAt) {
      await writeSyncMetadata('dataUpdatedAt', new Date().toISOString());
    }

    if (decision.action === 'push') {
      const localExportJson = await exportData();
      await github.updateGist(config.gistId, localExportJson);
    } else if (decision.action === 'pull') {
      await importData(remoteFileContent);
    }

    const now = new Date().toISOString();
    await writeSyncMetadata('lastSyncTime', now);
    if (decision.action !== 'no-change') {
      await writeSyncMetadata('lastSyncDirection', decision.action);
    }
    const action = decision.action === 'push' ? 'pushed' : decision.action === 'pull' ? 'pulled' : 'no-change';
    return { success: true, action, timestamp: now };
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

async function getSyncDecision(remoteFileContent: string): Promise<GistSyncDecision> {
  if (!remoteFileContent) {
    return decideGistSync({ state: 'missing' }, undefined);
  }

  let remoteData: ExportData;
  try {
    remoteData = JSON.parse(remoteFileContent);
  } catch {
    return decideGistSync({ state: 'invalid-json' }, undefined);
  }

  // Read only after parsing succeeds, before accessing the remote timestamp.
  const localDataUpdatedAt = await readSyncMetadata('dataUpdatedAt');
  return decideGistSync({ state: 'parsed', dataUpdatedAt: remoteData.dataUpdatedAt }, localDataUpdatedAt);
}
