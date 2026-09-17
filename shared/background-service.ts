import { createProxyService, type ProxyServiceKey } from '@webext-core/proxy-service';
import type { CatalogProblem } from '@/shared/catalog';
import type { GistDestination, GithubAuthStatus } from '@/shared/github-auth';
import type {
  Card,
  GistConnectionResult,
  GistSetup,
  GistSyncStatus,
  LeetcodeDomain,
  ProblemReference,
  RateCardInput,
  RatingPreview,
} from '@/shared/models';
import type { RoadmapId } from '@/shared/roadmap';
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
  shouldShowAutoOpenHint(): Promise<boolean>;
  markAutoOpenHintShown(): Promise<void>;
  previewRatings(problem: ProblemReference): Promise<RatingPreview>;
  addCard(problem: ProblemReference): Promise<void>;
  removeCard(frontendId: string): Promise<void>;
  delayCard(frontendId: string, days: number): Promise<void>;
  setPauseStatus(frontendId: string, paused: boolean): Promise<void>;
  rateCard(input: RateCardInput): Promise<Card>;
  saveNote(frontendId: string, text: string): Promise<void>;
  updateSettings(changes: SettingsUpdate): Promise<void>;
  setActiveRoadmap(id: RoadmapId | null): Promise<void>;
  setRoadmapProblemSkipped(roadmapId: RoadmapId, frontendId: string, skipped: boolean): Promise<void>;
  importData(jsonData: string): Promise<void>;
  resetAllData(): Promise<void>;
  setupGistSync(setup: GistSetup): Promise<GistConnectionResult>;
  setGistSyncEnabled(enabled: boolean): Promise<GistConnectionResult>;
  getGistSyncStatus(): Promise<GistSyncStatus>;
}

export const BACKGROUND_SERVICE_KEY = 'background' as ProxyServiceKey<BackgroundService>;
export const background = createProxyService(BACKGROUND_SERVICE_KEY);
