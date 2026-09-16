import { z } from 'zod';
import {
  cancelGithubSignInRequest,
  dismissGithubSetupPrompt,
  getGithubAuthStatus,
  startGithubSignIn,
} from '@/background/github-auth';
import {
  addCard,
  claimRatingHint,
  delayCard,
  previewRatings,
  rateCard,
  removeCard,
  saveNote,
  savePanelRating,
  setPauseStatus,
  undoPanelRating,
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
} from '@/background/persistence';
import type { BackgroundService } from '@/shared/background-service';
import { catalogProblemSchema, getProblemBySlug } from '@/shared/catalog';
import {
  gistSetupSchema,
  noteTextSchema,
  panelRatingInputSchema,
  panelUndoSchema,
  problemReferenceSchema,
  rateCardInputSchema,
} from '@/shared/models';
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

  let learningWrites = Promise.resolve();
  function learningCommand<Args extends unknown[], Result>(
    schema: z.ZodType<Args>,
    run: (...args: Args) => Result | Promise<Result>
  ): (...args: Args) => Promise<Result> {
    return command(schema, (...args) => {
      const next = learningWrites.then(() => run(...args));
      learningWrites = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    });
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
    claimRatingHint: command(z.tuple([]), claimRatingHint),
    previewRatings: learningCommand(z.tuple([problemReferenceSchema]), previewRatings),
    savePanelRating: learningCommand(z.tuple([panelRatingInputSchema]), savePanelRating),
    undoPanelRating: learningCommand(z.tuple([panelUndoSchema]), undoPanelRating),
    addCard: learningCommand(z.tuple([problemReferenceSchema]), addCard),
    removeCard: learningCommand(z.tuple([frontendId]), removeCard),
    delayCard: learningCommand(z.tuple([frontendId, z.int().nonnegative()]), delayCard),
    setPauseStatus: learningCommand(z.tuple([frontendId, z.boolean()]), setPauseStatus),
    rateCard: learningCommand(z.tuple([rateCardInputSchema]), rateCard),
    saveNote: learningCommand(z.tuple([frontendId, noteTextSchema]), saveNote),
    updateSettings: learningCommand(z.tuple([settingsUpdateSchema]), updateSettings),
    importData: learningCommand(z.tuple([z.string()]), restoreBackup),
    resetAllData: learningCommand(z.tuple([]), resetAllData),
    setupGistSync: command(z.tuple([gistSetupSchema]), connectGist),
    setGistSyncEnabled: command(z.tuple([z.boolean()]), setSyncEnabled),
    getGistSyncStatus: command(z.tuple([]), getSyncStatus),
  };
}
