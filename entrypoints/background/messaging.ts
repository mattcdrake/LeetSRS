import {
  addCard,
  delayCard,
  getAllCards,
  getReviewQueue,
  rateCard,
  removeCard,
  setPauseStatus,
} from '@/services/cards';
import { shouldResetEditor } from '@/services/editor-reset';
import {
  createNewGist,
  getGistSyncConfig,
  getGistSyncStatus,
  setGistSyncConfig,
  triggerGistSync,
  validateGistId,
  validatePat,
} from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { deleteNote, getNote, saveNote } from '@/services/notes';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';
import {
  type BackgroundMessageRegistry,
  type MessageData,
  type MessageName,
  type MessageResult,
  onMessage,
} from '@/shared/messages';

export const messages = {
  ping: { kind: 'read', handler: () => 'PONG' as const },
  addCard: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ problem }) => addCard(problem),
  },
  getAllCards: { kind: 'read', handler: () => getAllCards() },
  removeCard: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug }) => removeCard(slug),
  },
  delayCard: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug, days }) => delayCard(slug, days),
  },
  setPauseStatus: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug, paused }) => setPauseStatus(slug, paused),
  },
  rateCard: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ input }) => rateCard(input),
  },
  getReviewQueue: { kind: 'read', handler: () => getReviewQueue() },
  getTodayStats: { kind: 'read', handler: () => getTodayStats() },
  getNote: { kind: 'read', handler: ({ cardId }) => getNote(cardId) },
  saveNote: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: false,
    handler: ({ cardId, text }) => saveNote(cardId, text),
  },
  deleteNote: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: false,
    handler: ({ cardId }) => deleteNote(cardId),
  },
  getSettings: { kind: 'read', handler: () => getSettings() },
  updateSettings: {
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: ({ changes }) => updateSettings(changes),
  },
  shouldResetEditor: {
    kind: 'read',
    handler: ({ slug, domain }) => shouldResetEditor(slug, domain),
  },
  getCardStateStats: { kind: 'read', handler: () => getCardStateStats() },
  getLastNDaysStats: { kind: 'read', handler: ({ days }) => getLastNDaysStats(days) },
  getNextNDaysStats: { kind: 'read', handler: ({ days }) => getNextNDaysStats(days) },
  exportData: { kind: 'read', handler: () => exportData() },
  importData: {
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: ({ jsonData }) => importData(jsonData),
  },
  resetAllData: {
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: () => resetAllData(),
  },
  getGistSyncConfig: { kind: 'read', handler: () => getGistSyncConfig() },
  setGistSyncConfig: {
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: ({ config }) => setGistSyncConfig(config),
  },
  getGistSyncStatus: { kind: 'read', handler: () => getGistSyncStatus() },
  triggerGistSync: {
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: () => triggerGistSync(),
  },
  createNewGist: {
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: () => createNewGist(),
  },
  validatePat: { kind: 'read', handler: ({ pat }) => validatePat(pat) },
  validateGistId: {
    kind: 'read',
    handler: ({ gistId, pat }) => validateGistId(gistId, pat),
  },
} satisfies BackgroundMessageRegistry;

interface MessageExecutorOptions {
  ready: Promise<void>;
  markDataUpdated(): Promise<void>;
  refreshBadge(): Promise<void>;
}

export function createBackgroundMessageExecutor(options: MessageExecutorOptions) {
  // Writes share this promise chain so each one waits for the previous one
  // before touching storage. Reads skip the chain because they do not change
  // data. After a mutation fails, the stored tail is changed back to a resolved
  // promise so the next mutation can still run, while the caller still receives
  // the original error through `result`.
  let writeQueue = Promise.resolve();

  const execute = <Name extends MessageName>(
    message: BackgroundMessageRegistry[Name],
    data: MessageData<Name>
  ): Promise<MessageResult<Name>> => {
    const run = async () => {
      await options.ready;

      const result = await message.handler(data);

      if (message.kind === 'write') {
        if (message.syncTrackingOwner === 'executor') await options.markDataUpdated();
        if (message.refreshBadge) await options.refreshBadge();
      }

      return result;
    };

    if (message.kind === 'read') return run();

    const result = writeQueue.then(run);
    writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return { execute };
}

export function registerBackgroundMessages(registry: BackgroundMessageRegistry, options: MessageExecutorOptions) {
  const executor = createBackgroundMessageExecutor(options);

  const register = <Name extends MessageName>(name: Name) => {
    onMessage(name, ({ data }) => executor.execute(registry[name], data));
  };

  for (const name of Object.keys(registry) as MessageName[]) register(name);

  return executor;
}
