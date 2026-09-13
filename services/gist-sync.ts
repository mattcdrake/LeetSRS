import {
  decideGistSync,
  type GistConnectionResult,
  type GistSetup,
  type GistSyncStatus,
  type SyncResult,
} from '@/domain/gist-sync';
import { translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { createGitHubClient, GIST_FILENAME } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { parseLearningDocumentBackup } from '@/infrastructure/storage/learning-document-conversions';
import { readSyncMetadata, removeSyncStatus, writeSyncStatus } from '@/infrastructure/storage/sync-metadata';

// In-memory state for sync status (not persisted)
type SyncAttempt = {
  promise: Promise<SyncResult>;
  resolve: (result: SyncResult) => void;
};
let activeAttempt: SyncAttempt | undefined;
let followUp = false;
let generation = 0;
let arrivalRefresh: Promise<SyncResult | undefined> | undefined;
const unavailableNotice = 'You can continue learning. Sync will resume automatically when GitHub is available.';

export function refreshGistOnArrival(): Promise<SyncResult | undefined> {
  if (arrivalRefresh) return arrivalRefresh;
  const completion = Promise.withResolvers<SyncResult | undefined>();
  arrivalRefresh = completion.promise;
  const timer = setTimeout(() => {
    invalidateGistSync();
    lastError = unavailableNotice;
    finish({ success: false, error: unavailableNotice });
  }, 3000);
  function finish(result: SyncResult | undefined) {
    clearTimeout(timer);
    if (arrivalRefresh === completion.promise) arrivalRefresh = undefined;
    completion.resolve(result);
  }
  void requestAutomaticSync().then(finish);
  return completion.promise;
}

export async function waitForArrivalRefresh(): Promise<void> {
  await arrivalRefresh;
}
const obsoleteResult: SyncResult = { success: false, error: 'Sync stopped because data or connection changed.' };

export function invalidateGistSync(): void {
  generation++;
  const obsolete = activeAttempt;
  activeAttempt = undefined;
  followUp = false;
  obsolete?.resolve(obsoleteResult);
}
let lastError: string | null = null;

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  const lastSyncTime = (await readSyncMetadata('lastSyncTime')) ?? null;
  const lastSyncDirection = (await readSyncMetadata('lastSyncDirection')) ?? null;
  return {
    lastSyncTime,
    lastSyncDirection,
    syncInProgress: activeAttempt !== undefined,
    lastError,
  };
}

export function triggerGistSync(): Promise<SyncResult> {
  if (activeAttempt) return activeAttempt.promise;
  const attempt = Promise.withResolvers<SyncResult>();
  activeAttempt = attempt;
  lastError = null;
  void runSync(attempt).then((result) => {
    if (activeAttempt !== attempt) return;
    activeAttempt = undefined;
    attempt.resolve(result);
    if (followUp) {
      followUp = false;
      void requestAutomaticSync();
    }
  });
  return attempt.promise;
}

export async function requestAutomaticSync(afterSave = false): Promise<SyncResult | undefined> {
  const requestedGeneration = generation;
  try {
    const config = await readGistConnection();
    if (generation !== requestedGeneration) return;
    if (!config.enabled || !config.pat.trim() || !config.gistId?.trim()) return;
    if (afterSave && activeAttempt) followUp = true;
    return await triggerGistSync();
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Unable to sync';
    return { success: false, error: lastError };
  }
}

async function runSync(attempt: SyncAttempt): Promise<SyncResult> {
  try {
    const config = await readGistConnection();
    if (activeAttempt !== attempt) return obsoleteResult;

    if (!config.pat) {
      throw new Error('PAT is not configured. Add your GitHub token in Settings.');
    }

    if (!config.gistId) {
      throw new Error('Gist ID is not configured. Choose a Gist in Settings.');
    }

    const github = createGitHubClient(config.pat);

    let remoteGist: Awaited<ReturnType<typeof github.getGist>>['data'];
    try {
      const { data } = await github.getGist(config.gistId);
      if (activeAttempt !== attempt) return obsoleteResult;
      remoteGist = data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error('Gist not found. Check the Gist ID and token access in Settings.');
      }
      throw error;
    }

    const remoteFile = remoteGist.files?.[GIST_FILENAME];
    // Validate even when local data would win, before either side can be overwritten.
    const remote = remoteFile ? parseLearningDocumentBackup(remoteFile.content ?? '') : undefined;
    const local = await readLearningDocument();
    if (activeAttempt !== attempt) return obsoleteResult;

    const { action } = decideGistSync(
      remote ? { state: 'parsed', dataUpdatedAt: remote.dataUpdatedAt } : { state: 'missing' },
      local.dataUpdatedAt
    );

    // Sync never creates a learner edit, including when both timestamps are absent.
    if (action === 'push') {
      await github.updateGist(config.gistId, JSON.stringify(local, null, 2));
    } else if (action === 'pull' && remote) {
      await replaceLearningDocument(remote);
    }

    if (activeAttempt !== attempt) return obsoleteResult;
    const now = new Date().toISOString();
    await writeSyncStatus({
      lastSyncTime: now,
      lastSyncDirection: action === 'no-change' ? undefined : action,
    });
    const resultActions = { push: 'pushed', pull: 'pulled', 'no-change': 'no-change' } as const;
    return { success: true, action: resultActions[action], timestamp: now };
  } catch (error) {
    if (activeAttempt !== attempt) return obsoleteResult;
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    lastError =
      /rate limit/i.test(message) || status === 429
        ? 'GitHub API rate limit exceeded. Please try again later. You can continue learning.'
        : status === 401 || status === 403 || /401|403|bad credentials/i.test(message)
          ? 'Check your GitHub token and its Gist permission in Settings.'
          : /fetch|network|offline|timeout/i.test(message) || (typeof status === 'number' && status >= 500)
            ? unavailableNotice
            : message;
    return { success: false, error: lastError };
  }
}

export async function setupGistSync(setup: GistSetup): Promise<GistConnectionResult> {
  let createdGistId: string | undefined;
  const setupGeneration = generation;
  function requireCurrentSetup() {
    if (generation !== setupGeneration) throw new Error('Gist setup stopped because data or connection changed.');
  }
  try {
    const previous = await readGistConnection();
    requireCurrentSetup();
    const github = createGitHubClient(setup.pat);
    let gistId: string;
    if (setup.mode === 'existing') {
      const { data } = await github.getGist(setup.gistId);
      if (!data.files?.[GIST_FILENAME]) {
        throw new Error(`Gist does not contain ${GIST_FILENAME}`);
      }
      gistId = setup.gistId;
    } else {
      const document = await readLearningDocument();
      requireCurrentSetup();
      const language = document.settings.language ?? detectBrowserLanguage();
      const { data } = await github.createGist(
        translations[language].settings.gistSync.gistDescription,
        JSON.stringify(document, null, 2)
      );
      if (!data.id) throw new Error('Failed to create gist: no ID returned');
      gistId = data.id;
      createdGistId = gistId;
    }
    requireCurrentSetup();
    invalidateGistSync();
    await writeGistConnection({ pat: setup.pat, gistId, enabled: previous.enabled });
    if (createdGistId) {
      try {
        const timestamp = new Date().toISOString();
        await writeSyncStatus({ lastSyncTime: timestamp, lastSyncDirection: 'push' });
        lastError = null;
        return { saved: true, sync: { success: true, action: 'pushed', timestamp } };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Failed to record Gist creation';
        return { saved: true, sync: { success: false, error: lastError } };
      }
    }
    return { saved: true, ...(previous.enabled ? { sync: await triggerGistSync() } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gist setup error';
    return {
      saved: false,
      error: message.includes('404') ? 'Gist not found' : message,
      ...(createdGistId ? { createdGistId } : {}),
    };
  }
}

export async function setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult> {
  try {
    const config = await readGistConnection();
    if (enabled && (!config.pat.trim() || !config.gistId?.trim())) {
      throw new Error('PAT and Gist ID are required to enable sync');
    }
    invalidateGistSync();
    await writeGistConnection({ ...config, enabled });
  } catch (error) {
    return { saved: false, error: error instanceof Error ? error.message : 'Failed to save connection' };
  }
  return { saved: true, ...(enabled ? { sync: await triggerGistSync() } : {}) };
}

export async function resetGistSyncStatus(): Promise<void> {
  await removeSyncStatus();
  lastError = null;
}
