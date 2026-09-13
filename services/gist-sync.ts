import {
  decideGistSync,
  type GistConnectionResult,
  type GistSetup,
  type GistSyncConfig,
  type GistSyncStatus,
  type SyncResult,
} from '@/domain/gist-sync';
import { type Translations, translations } from '@/i18n';
import { detectBrowserLanguage } from '@/infrastructure/browser/language';
import { createGitHubClient, GIST_FILENAME } from '@/infrastructure/github/client';
import { readGistConnection, writeGistConnection } from '@/infrastructure/storage/gist-connection';
import { readLearningDocument, replaceLearningDocument } from '@/infrastructure/storage/learning-document';
import { parseLearningDocumentBackup } from '@/infrastructure/storage/learning-document-conversions';
import { readSyncMetadata, removeSyncStatus, writeSyncStatus } from '@/infrastructure/storage/sync-metadata';
import { getDocumentTranslations } from '@/infrastructure/storage/translations';

type SyncAttempt = {
  promise: Promise<SyncResult | undefined>;
  resolve: (result: SyncResult | undefined) => void;
  connection: Promise<GistSyncConfig>;
  arrival?: Promise<SyncResult | undefined>;
  manual: boolean;
  followUp: boolean;
  notices: Translations['syncNotices'];
  deadline?: ReturnType<typeof setTimeout>;
};
let activeAttempt: SyncAttempt | undefined;
let generation = 0;
let lastError: string | null = null;

function canSyncAutomatically(config: GistSyncConfig) {
  return config.enabled && !!config.pat.trim() && !!config.gistId?.trim();
}

async function getSyncNotices() {
  return getDocumentTranslations().then(
    (t) => t.syncNotices,
    () => translations[detectBrowserLanguage()].syncNotices
  );
}

function finishSync(attempt: SyncAttempt, result?: SyncResult) {
  if (activeAttempt !== attempt) return;
  clearTimeout(attempt.deadline);
  activeAttempt = undefined;
  attempt.resolve(result);
  if (attempt.followUp) void triggerGistSync('alarm');
}

export function invalidateGistSync(): void {
  generation++;
  if (!activeAttempt) return;
  activeAttempt.followUp = false;
  finishSync(activeAttempt, { success: false, error: activeAttempt.notices.obsolete });
}

export async function waitForArrivalRefresh(): Promise<void> {
  await activeAttempt?.arrival;
}

export async function getGistSyncStatus(): Promise<GistSyncStatus> {
  return {
    lastSyncTime: (await readSyncMetadata('lastSyncTime')) ?? null,
    lastSyncDirection: (await readSyncMetadata('lastSyncDirection')) ?? null,
    syncInProgress: activeAttempt !== undefined,
    lastError,
  };
}

export function triggerGistSync(): Promise<SyncResult>;
export function triggerGistSync(reason: 'arrival' | 'save' | 'alarm'): Promise<SyncResult | undefined>;
export function triggerGistSync(reason = 'manual'): Promise<SyncResult | undefined> {
  if (!activeAttempt) {
    activeAttempt = {
      ...Promise.withResolvers<SyncResult | undefined>(),
      connection: readGistConnection(),
      manual: reason === 'manual',
      followUp: false,
      notices: translations[detectBrowserLanguage()].syncNotices,
    };
    void runSync(activeAttempt);
  } else if (reason === 'save') {
    activeAttempt.followUp = true;
  }
  const attempt = activeAttempt;
  if (reason === 'manual') attempt.manual = true;
  const result =
    reason === 'manual'
      ? attempt.promise
      : Promise.race([
          attempt.promise,
          attempt.connection.then(
            (config) => (canSyncAutomatically(config) ? attempt.promise : undefined),
            () => attempt.promise
          ),
        ]);
  if (reason === 'arrival' && !attempt.arrival) {
    attempt.arrival = result;
    attempt.deadline = setTimeout(() => {
      lastError = attempt.notices.unavailable;
      finishSync(attempt, { success: false, error: lastError });
    }, 3000);
    void result.then(() => clearTimeout(attempt.deadline));
  }
  return result;
}

async function runSync(attempt: SyncAttempt): Promise<void> {
  try {
    const [config, notices] = await Promise.all([attempt.connection, getSyncNotices()]);
    if (activeAttempt !== attempt) return;
    attempt.notices = notices;
    if (!attempt.manual && !canSyncAutomatically(config)) {
      finishSync(attempt);
      return;
    }
    lastError = null;
    if (!config.pat.trim()) throw new Error(notices.missingToken);
    if (!config.gistId?.trim()) throw new Error(notices.missingGist);
    const github = createGitHubClient(config.pat);
    const { data } = await github.getGist(config.gistId);
    if (activeAttempt !== attempt) return;
    const remoteFile = data.files?.[GIST_FILENAME];
    // Validate the remote even when local data wins, then compare fresh local data.
    const remote = remoteFile ? parseLearningDocumentBackup(remoteFile.content ?? '') : undefined;
    const local = await readLearningDocument();
    if (activeAttempt !== attempt) return;
    const { action } = decideGistSync(
      remote ? { state: 'parsed', dataUpdatedAt: remote.dataUpdatedAt } : { state: 'missing' },
      local.dataUpdatedAt
    );
    if (action === 'push') await github.updateGist(config.gistId, JSON.stringify(local, null, 2));
    else if (action === 'pull' && remote) await replaceLearningDocument(remote);
    if (activeAttempt !== attempt) return;
    const timestamp = new Date().toISOString();
    await writeSyncStatus({ lastSyncTime: timestamp, lastSyncDirection: action === 'no-change' ? undefined : action });
    const resultActions = { push: 'pushed', pull: 'pulled', 'no-change': 'no-change' } as const;
    finishSync(attempt, { success: true, action: resultActions[action], timestamp });
  } catch (error) {
    if (activeAttempt !== attempt) return;
    const message = error instanceof Error ? error.message : attempt.notices.refreshFailed;
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    const notices = attempt.notices;
    lastError =
      /rate limit/i.test(message) || status === 429
        ? notices.rateLimit
        : status === 401 || status === 403 || /401|403|bad credentials/i.test(message)
          ? notices.authentication
          : status === 404 || /404/.test(message)
            ? notices.gistNotFound
            : /fetch|network|offline|timeout/i.test(message) || (typeof status === 'number' && status >= 500)
              ? notices.unavailable
              : message;
    finishSync(attempt, { success: false, error: lastError });
  }
}

export async function setupGistSync(setup: GistSetup): Promise<GistConnectionResult> {
  let createdGistId: string | undefined;
  const setupGeneration = generation;
  const notices = await getSyncNotices();
  function requireCurrentSetup() {
    if (generation !== setupGeneration) throw new Error(notices.setupStopped);
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
    const message = error instanceof Error ? error.message : notices.refreshFailed;
    return {
      saved: false,
      error: message.includes('404') ? 'Gist not found' : message,
      ...(createdGistId ? { createdGistId } : {}),
    };
  }
}

export async function setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult> {
  const connectionGeneration = generation;
  try {
    const config = await readGistConnection();
    if (generation !== connectionGeneration) return { saved: false, error: (await getSyncNotices()).obsolete };
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
