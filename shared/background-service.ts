import { createProxyService, type ProxyServiceKey } from '@webext-core/proxy-service';
import type { CatalogProblem } from '@/shared/catalog';
import type { GistDestination, GithubAuthStatus } from '@/shared/github-auth';
import type {
  GistConnectionResult,
  GistSetup,
  GistSyncStatus,
  LeetcodeDomain,
  PanelRatingInput,
  PanelSave,
  PanelUndo,
  ProblemReference,
  RateCardInput,
  RatingPreview,
} from '@/shared/models';
import type { SettingsUpdate } from '@/shared/settings';

export interface BackgroundService {
  dismissGithubSetupPrompt(): Promise<void>;
  cancelGithubSignInRequest(): Promise<void>;
  startGithubSignIn(): Promise<void>;
  signOutGithub(): Promise<void>;
  getGithubAuthStatus(): Promise<GithubAuthStatus>;
  listGistDestinations(): Promise<GistDestination[]>;
  dismissMigrationNotice(): Promise<void>;
  waitForInitialization(): Promise<void>;
  getProblem(slug: string, domain: LeetcodeDomain): Promise<CatalogProblem>;
  claimRatingHint(): Promise<boolean>;
  previewRatings(problem: ProblemReference): Promise<RatingPreview>;
  savePanelRating(input: PanelRatingInput): Promise<PanelSave>;
  undoPanelRating(undo: PanelUndo): Promise<void>;
  addCard(problem: ProblemReference): Promise<void>;
  removeCard(frontendId: string): Promise<void>;
  delayCard(frontendId: string, days: number): Promise<void>;
  setPauseStatus(frontendId: string, paused: boolean): Promise<void>;
  rateCard(input: RateCardInput): Promise<void>;
  saveNote(frontendId: string, text: string): Promise<void>;
  updateSettings(changes: SettingsUpdate): Promise<void>;
  importData(jsonData: string): Promise<void>;
  resetAllData(): Promise<void>;
  setupGistSync(setup: GistSetup): Promise<GistConnectionResult>;
  setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult>;
  getGistSyncStatus(): Promise<GistSyncStatus>;
}

export const BACKGROUND_SERVICE_KEY = 'background' as ProxyServiceKey<BackgroundService>;
export const background = createProxyService(BACKGROUND_SERVICE_KEY);
