import { z } from 'zod';
import {
  cancelGithubSignInRequest,
  dismissGithubSetupPrompt,
  getGithubAuthStatus,
  startGithubSignIn,
} from '@/background/github-auth';
import {
  addCard,
  delayCard,
  markAutoOpenHintShown,
  previewRatings,
  rateCard,
  removeCard,
  saveNote,
  setPauseStatus,
  shouldShowAutoOpenHint,
  updateSettings,
} from '@/background/learning';
import { dismissMigrationNotice } from '@/background/legacy/github-pat';
import {
  connectGist,
  disconnectGithub,
  getSyncStatus,
  listGistDestinations,
  resetAllData,
  restoreBackup,
  setSyncEnabled,
} from '@/background/sync';
import type { BackgroundService } from '@/shared/background-service';
import { catalogProblemSchema, getProblemBySlug } from '@/shared/catalog';
import { gistSetupSchema, noteTextSchema, problemReferenceSchema, rateCardInputSchema } from '@/shared/models';
import { settingsUpdateSchema } from '@/shared/settings';

export function createBackgroundService(ready: Promise<void>): BackgroundService {
  function command<Args extends unknown[], Result>(
    schema: z.ZodType<Args>,
    run: (...args: Args) => Result | Promise<Result>
  ): (...args: Args) => Promise<Result> {
    return async (...args) => {
      await ready;
      return await run(...schema.parse(args));
    };
  }

  const frontendId = problemReferenceSchema.shape.frontendId;
  return {
    dismissGithubSetupPrompt: command(z.tuple([]), dismissGithubSetupPrompt),
    cancelGithubSignInRequest: command(z.tuple([]), cancelGithubSignInRequest),
    startGithubSignIn: command(z.tuple([]), startGithubSignIn),
    signOutGithub: command(z.tuple([]), disconnectGithub),
    getGithubAuthStatus: command(z.tuple([]), getGithubAuthStatus),
    dismissMigrationNotice: command(z.tuple([]), dismissMigrationNotice),
    listGistDestinations: command(z.tuple([]), listGistDestinations),
    waitForInitialization: command(z.tuple([]), () => undefined),
    getProblem: command(
      z.tuple([catalogProblemSchema.shape.slug, problemReferenceSchema.shape.domain]),
      async (slug, domain) => {
        const problem = await getProblemBySlug(slug, domain);
        if (!problem) throw new Error(`Unknown problem: ${slug} on ${domain}`);
        return problem;
      }
    ),
    shouldShowAutoOpenHint,
    markAutoOpenHintShown,
    previewRatings: command(z.tuple([problemReferenceSchema]), previewRatings),
    addCard: command(z.tuple([problemReferenceSchema]), addCard),
    removeCard: command(z.tuple([frontendId]), removeCard),
    delayCard: command(z.tuple([frontendId, z.int().nonnegative()]), delayCard),
    setPauseStatus: command(z.tuple([frontendId, z.boolean()]), setPauseStatus),
    rateCard: command(z.tuple([rateCardInputSchema]), rateCard),
    saveNote: command(z.tuple([frontendId, noteTextSchema]), saveNote),
    updateSettings: command(z.tuple([settingsUpdateSchema]), updateSettings),
    importData: command(z.tuple([z.string()]), restoreBackup),
    resetAllData: command(z.tuple([]), resetAllData),
    setupGistSync: command(z.tuple([gistSetupSchema]), connectGist),
    setGistSyncEnabled: command(z.tuple([z.boolean()]), setSyncEnabled),
    getGistSyncStatus: command(z.tuple([]), getSyncStatus),
  };
}
