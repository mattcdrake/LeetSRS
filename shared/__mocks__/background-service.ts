import { vi } from 'vitest';
import type { BackgroundService } from '@/shared/background-service';

const actual = await vi.importActual<typeof import('@/shared/background-service')>('@/shared/background-service');
export const BACKGROUND_SERVICE_KEY = actual.BACKGROUND_SERVICE_KEY;

export const background = {
  shouldShowAutoOpenHint: vi.fn<BackgroundService['shouldShowAutoOpenHint']>(),
  markAutoOpenHintShown: vi.fn<BackgroundService['markAutoOpenHintShown']>(),
  previewRatings: vi.fn<BackgroundService['previewRatings']>(),
  dismissGithubSetupPrompt: vi.fn<BackgroundService['dismissGithubSetupPrompt']>(),
  cancelGithubSignInRequest: vi.fn<BackgroundService['cancelGithubSignInRequest']>(),
  startGithubSignIn: vi.fn<BackgroundService['startGithubSignIn']>(),
  signOutGithub: vi.fn<BackgroundService['signOutGithub']>(),
  getGithubAuthStatus: vi.fn<BackgroundService['getGithubAuthStatus']>(),
  listGistDestinations: vi.fn<BackgroundService['listGistDestinations']>(),
  dismissMigrationNotice: vi.fn<BackgroundService['dismissMigrationNotice']>(),
  waitForInitialization: vi.fn<BackgroundService['waitForInitialization']>(),
  getProblem: vi.fn<BackgroundService['getProblem']>(),
  addCard: vi.fn<BackgroundService['addCard']>(),
  removeCard: vi.fn<BackgroundService['removeCard']>(),
  delayCard: vi.fn<BackgroundService['delayCard']>(),
  setPauseStatus: vi.fn<BackgroundService['setPauseStatus']>(),
  rateCard: vi.fn<BackgroundService['rateCard']>(),
  saveNote: vi.fn<BackgroundService['saveNote']>(),
  updateSettings: vi.fn<BackgroundService['updateSettings']>(),
  importData: vi.fn<BackgroundService['importData']>(),
  resetAllData: vi.fn<BackgroundService['resetAllData']>(),
  setupGistSync: vi.fn<BackgroundService['setupGistSync']>(),
  setGistSyncEnabled: vi.fn<BackgroundService['setGistSyncEnabled']>(),
  getGistSyncStatus: vi.fn<BackgroundService['getGistSyncStatus']>(),
} satisfies BackgroundService;
