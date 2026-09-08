import { type MessageName, onMessage } from '@/infrastructure/browser/messages';
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
import { validatePat } from '@/services/github-auth';
import {
  createNewGist,
  getGistSyncConfig,
  getGistSyncStatus,
  setGistSyncConfig,
  triggerGistSync,
  validateGistId,
} from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { deleteNote, getNote, saveNote } from '@/services/notes';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';
import type { BackgroundMessageRegistry } from './message-runner';
import { createBackgroundMessageRunner, type MessageRunnerOptions } from './message-runner';

export const messages = {
  addCard: {
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ problem }) => addCard(problem),
  },
  getAllCards: { kind: 'read', handler: getAllCards },
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
  getReviewQueue: { kind: 'read', handler: getReviewQueue },
  getTodayStats: { kind: 'read', handler: getTodayStats },
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
  getSettings: { kind: 'read', handler: getSettings },
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
  getCardStateStats: { kind: 'read', handler: getCardStateStats },
  getLastNDaysStats: { kind: 'read', handler: ({ days }) => getLastNDaysStats(days) },
  getNextNDaysStats: { kind: 'read', handler: ({ days }) => getNextNDaysStats(days) },
  exportData: { kind: 'read', handler: exportData },
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
    handler: resetAllData,
  },
  getGistSyncConfig: { kind: 'read', handler: getGistSyncConfig },
  setGistSyncConfig: {
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: ({ config }) => setGistSyncConfig(config),
  },
  getGistSyncStatus: { kind: 'read', handler: getGistSyncStatus },
  triggerGistSync: {
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: triggerGistSync,
  },
  createNewGist: {
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: createNewGist,
  },
  validatePat: { kind: 'read', handler: ({ pat }) => validatePat(pat) },
  validateGistId: {
    kind: 'read',
    handler: ({ gistId, pat }) => validateGistId(gistId, pat),
  },
} satisfies BackgroundMessageRegistry;

export function registerBackgroundMessages(registry: BackgroundMessageRegistry, options: MessageRunnerOptions) {
  const runner = createBackgroundMessageRunner(options);

  const register = <Name extends MessageName>(name: Name) => {
    onMessage(name, ({ data }) => runner.execute(registry[name], data));
  };

  for (const name of Object.keys(registry) as MessageName[]) register(name);

  return runner;
}
