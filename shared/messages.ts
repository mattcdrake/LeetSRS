import { defineExtensionMessaging } from '@webext-core/messaging';
import type { State as FsrsState } from 'ts-fsrs';
import type { DailyStats, UpcomingReviewStats } from '@/services/stats';
import type { Card, LeetcodeDomain, ProblemDescriptor, RateCardInput } from '@/shared/cards';
import type {
  GistSyncConfig,
  GistSyncStatus,
  GistValidationResult,
  PatValidationResult,
  SyncResult,
} from '@/shared/gist-sync';
import type { Note } from '@/shared/notes';
import type { Settings } from '@/shared/settings';

export interface ExtensionProtocolMap {
  ping(): 'PONG';
  addCard(data: { problem: ProblemDescriptor }): Card;
  getAllCards(): Card[];
  removeCard(data: { slug: string }): void;
  delayCard(data: { slug: string; days: number }): Card;
  setPauseStatus(data: { slug: string; paused: boolean }): Card;
  rateCard(data: { input: RateCardInput }): { card: Card; shouldRequeue: boolean };
  getReviewQueue(): Card[];
  getTodayStats(): DailyStats | null;
  getNote(data: { cardId: string }): Note | null;
  saveNote(data: { cardId: string; text: string }): void;
  deleteNote(data: { cardId: string }): void;
  getSettings(): Settings;
  updateSettings(data: { changes: Partial<Settings> }): void;
  shouldResetEditor(data: { slug: string; domain: LeetcodeDomain }): boolean;
  getCardStateStats(): Record<FsrsState, number>;
  getLastNDaysStats(data: { days: number }): DailyStats[];
  getNextNDaysStats(data: { days: number }): UpcomingReviewStats[];
  exportData(): string;
  importData(data: { jsonData: string }): void;
  resetAllData(): void;
  getGistSyncConfig(): GistSyncConfig;
  setGistSyncConfig(data: { config: Partial<GistSyncConfig> }): void;
  getGistSyncStatus(): GistSyncStatus;
  triggerGistSync(): SyncResult;
  createNewGist(): { gistId: string };
  validatePat(data: { pat: string }): PatValidationResult;
  validateGistId(data: { gistId: string; pat: string }): GistValidationResult;
}

export const { onMessage, sendMessage } = defineExtensionMessaging<ExtensionProtocolMap>();
