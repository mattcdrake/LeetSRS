import { type MessageName, messagePayloadSchemas, onMessage } from '@/infrastructure/browser/messages';
import { deleteNote, getNote, saveNote } from '@/infrastructure/storage/notes';
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
import { createNewGist, getGistSyncConfig, setGistSyncConfig, validateGistId } from '@/services/gist-setup';
import { validatePat } from '@/services/github-auth';
import { getGistSyncStatus, triggerGistSync } from '@/services/github-sync';
import { exportData, importData, resetAllData } from '@/services/import-export';
import { getSettings, updateSettings } from '@/services/settings';
import { getCardStateStats, getLastNDaysStats, getNextNDaysStats, getTodayStats } from '@/services/stats';
import type { BackgroundMessageRegistry } from './message-runner';
import { createBackgroundMessageRunner, type MessageRunnerOptions } from './message-runner';

export const messages = {
  addCard: {
    schema: messagePayloadSchemas.addCard,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ problem }) => addCard(problem),
  },
  getAllCards: { schema: messagePayloadSchemas.getAllCards, kind: 'read', handler: getAllCards },
  removeCard: {
    schema: messagePayloadSchemas.removeCard,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug }) => removeCard(slug),
  },
  delayCard: {
    schema: messagePayloadSchemas.delayCard,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug, days }) => delayCard(slug, days),
  },
  setPauseStatus: {
    schema: messagePayloadSchemas.setPauseStatus,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ slug, paused }) => setPauseStatus(slug, paused),
  },
  rateCard: {
    schema: messagePayloadSchemas.rateCard,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: true,
    handler: ({ input }) => rateCard(input),
  },
  getReviewQueue: { schema: messagePayloadSchemas.getReviewQueue, kind: 'read', handler: getReviewQueue },
  getTodayStats: { schema: messagePayloadSchemas.getTodayStats, kind: 'read', handler: getTodayStats },
  getNote: { schema: messagePayloadSchemas.getNote, kind: 'read', handler: ({ cardId }) => getNote(cardId) },
  saveNote: {
    schema: messagePayloadSchemas.saveNote,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: false,
    handler: ({ cardId, text }) => saveNote(cardId, text),
  },
  deleteNote: {
    schema: messagePayloadSchemas.deleteNote,
    kind: 'write',
    syncTrackingOwner: 'executor',
    refreshBadge: false,
    handler: ({ cardId }) => deleteNote(cardId),
  },
  getSettings: { schema: messagePayloadSchemas.getSettings, kind: 'read', handler: getSettings },
  updateSettings: {
    schema: messagePayloadSchemas.updateSettings,
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: ({ changes }) => updateSettings(changes),
  },
  shouldResetEditor: {
    schema: messagePayloadSchemas.shouldResetEditor,
    kind: 'read',
    handler: ({ slug, domain }) => shouldResetEditor(slug, domain),
  },
  getCardStateStats: { schema: messagePayloadSchemas.getCardStateStats, kind: 'read', handler: getCardStateStats },
  getLastNDaysStats: {
    schema: messagePayloadSchemas.getLastNDaysStats,
    kind: 'read',
    handler: ({ days }) => getLastNDaysStats(days),
  },
  getNextNDaysStats: {
    schema: messagePayloadSchemas.getNextNDaysStats,
    kind: 'read',
    handler: ({ days }) => getNextNDaysStats(days),
  },
  exportData: { schema: messagePayloadSchemas.exportData, kind: 'read', handler: exportData },
  importData: {
    schema: messagePayloadSchemas.importData,
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: ({ jsonData }) => importData(jsonData),
  },
  resetAllData: {
    schema: messagePayloadSchemas.resetAllData,
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: resetAllData,
  },
  getGistSyncConfig: { schema: messagePayloadSchemas.getGistSyncConfig, kind: 'read', handler: getGistSyncConfig },
  setGistSyncConfig: {
    schema: messagePayloadSchemas.setGistSyncConfig,
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: ({ config }) => setGistSyncConfig(config),
  },
  getGistSyncStatus: { schema: messagePayloadSchemas.getGistSyncStatus, kind: 'read', handler: getGistSyncStatus },
  triggerGistSync: {
    schema: messagePayloadSchemas.triggerGistSync,
    kind: 'write',
    syncTrackingOwner: 'handler',
    refreshBadge: true,
    handler: triggerGistSync,
  },
  createNewGist: {
    schema: messagePayloadSchemas.createNewGist,
    kind: 'write',
    syncTrackingOwner: 'none',
    refreshBadge: false,
    handler: createNewGist,
  },
  validatePat: { schema: messagePayloadSchemas.validatePat, kind: 'read', handler: ({ pat }) => validatePat(pat) },
  validateGistId: {
    schema: messagePayloadSchemas.validateGistId,
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
