import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { LuCheck, LuCircleAlert, LuUndo2 } from 'react-icons/lu';
import type { Grade } from 'ts-fsrs';
import type { CardStatus } from '@/background/learning';
import { getCurrentProblem } from '@/content/current-problem';
import { background } from '@/shared/background-service';
import { formatDue } from '@/shared/due';
import type { Translations } from '@/shared/i18n/index';
import { type RatingPreview, ratingSchema } from '@/shared/learning-document';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { RatingOptions } from '@/shared/ui/RatingOptions';
import { RATING_COLORS } from '@/shared/ui/rating-colors';
import { YouTubeLink } from '@/shared/ui/YouTubeLink';
import { NextProblems } from './NextProblems';
import { useSurfaceTheme } from './theme';
import type { SavedConfirmation, useRatingSession } from './useRatingSession';

type CurrentProblem = Awaited<ReturnType<typeof getCurrentProblem>>;

// Ignore pointer activation on the shorter saved view, which can land a link under the pointer.
const POINTER_GUARD_MS = 300;

export function RatingMenu({ t, session }: { t: Translations; session: ReturnType<typeof useRatingSession> }) {
  const { saved, busy } = session;
  const theme = useSurfaceTheme();
  const colors = RATING_COLORS[theme];
  const [problem, setProblem] = useState<CurrentProblem>();
  const [preview, setPreview] = useState<RatingPreview>();
  const [status, setStatus] = useState<CardStatus | null>();
  const [hint, setHint] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<number>();
  const showSaved = saved && selected === undefined;
  const [pointerGuard, setPointerGuard] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLFieldSetElement>(null);
  const reference = problem && { frontendId: problem.frontendId, domain: problem.domain };
  // Matches the popup, which saves existing cards only with a rating.
  const allowUnrated = !status;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and undo reload the preview.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const metadata = await getCurrentProblem();
        if (!active) return;
        setProblem(metadata);
        const reference = { frontendId: metadata.frontendId, domain: metadata.domain };
        const [preview, status] = await Promise.all([
          background.previewRatings(reference),
          background.getCardStatus(reference.frontendId),
        ]);
        if (!active) return;
        setPreview(preview);
        setStatus(status);
      } catch (error) {
        console.error('LeetSRS could not load the rating panel:', error);
        if (active) setLoadFailed(true);
        return;
      }
      try {
        const showHint = await background.shouldShowAutoOpenHint();
        if (active) setHint(showHint);
      } catch (error) {
        console.error('LeetSRS could not read the auto-open hint:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!hint || saved) return;
    void background.markAutoOpenHintShown().catch((error: unknown) => {
      console.error('LeetSRS could not record the auto-open hint:', error);
      setHint(false);
    });
  }, [hint, saved]);

  useEffect(() => {
    if (selected === undefined) return;
    if (session.error) {
      setSelected(undefined);
      return;
    }
    const timeout = setTimeout(() => setSelected(undefined), 400);
    return () => clearTimeout(timeout);
  }, [selected, session.error]);

  useLayoutEffect(() => {
    if (!showSaved) return;
    setPointerGuard(true);
    const timeout = setTimeout(() => setPointerGuard(false), POINTER_GUARD_MS);
    return () => clearTimeout(timeout);
  }, [showSaved]);

  useEffect(() => {
    if (showSaved || !saved) container.current?.focus();
  }, [showSaved, saved]);

  function save(rating?: Grade) {
    if (!reference || !preview || saved || busy || selected !== undefined) return;
    if (rating === undefined && !allowUnrated) return;
    // Pressing a row disables it, so keep focus on the panel rather than letting it fall through.
    container.current?.focus();
    setSelected(rating ?? 5);
    session.save(reference, rating);
  }

  function undo() {
    container.current?.focus();
    void session.undo().then((undone) => {
      if (!undone) return;
      setPreview(undefined);
      setAttempt((value) => value + 1);
    });
  }

  const youtube = problem?.youtubeUrl && (
    <YouTubeLink
      url={problem.youtubeUrl}
      label={t.youtubeSolution}
      className="-mr-1.5 size-6 rounded-md text-fg-3 hover:text-fg-2 focus-visible:outline-focus"
    />
  );

  return (
    <fieldset
      ref={container}
      tabIndex={-1}
      className="rating-panel"
      data-theme={theme}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
        const rating = ratingSchema.safeParse(Number(event.key));
        if (!rating.success && !(event.key === '5' && allowUnrated)) return;
        event.preventDefault();
        event.stopPropagation();
        if (!busy) save(rating.success ? rating.data : undefined);
      }}
    >
      {showSaved ? (
        <>
          <SavedView t={t} saved={saved} color={saved.rating && colors[saved.rating]} busy={busy} onUndo={undo} />
          {session.error === 'undo' && <ErrorBanner>{t.contentScript.undoFailed}</ErrorBanner>}
        </>
      ) : (
        <>
          <div className="px-3.5 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[14px] font-semibold tracking-[-0.01em]">
                {t.contentScript.howDidItGo}
              </div>
              <span className="rating-wordmark shrink-0 text-fg-3">
                Leet<span className="text-brand">SRS</span>
              </span>
            </div>
            <div className="mt-0.5 flex h-5 items-center gap-2">
              {problem && preview && !loadFailed ? (
                <>
                  <div className="min-w-0 flex-1 truncate text-[12px] text-fg-3">
                    <span className="tabular-nums">{problem.frontendId}.</span>{' '}
                    {getProblemTitle(problem, problem.domain)}
                    {status && (
                      <>
                        {' · '}
                        <span className="font-medium text-fg-2">{formatStatus(status, t)}</span>
                      </>
                    )}
                  </div>
                  {youtube}
                </>
              ) : (
                <div className="h-2 w-36 rounded-full bg-raised" />
              )}
            </div>
          </div>
          {loadFailed ? (
            <ErrorBanner
              action={
                <Button
                  className="-my-0.5 shrink-0 cursor-pointer rounded-md bg-surface px-2 py-0.5 font-medium text-fg shadow-[0_0_0_1px_var(--ls-line)] data-focus-visible:outline-2 data-focus-visible:outline-focus data-focus-visible:outline-offset-2"
                  onPress={() => {
                    setLoadFailed(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  {t.contentScript.retry}
                </Button>
              }
            >
              {t.problemSave.previewFailed}
            </ErrorBanner>
          ) : (
            session.error === 'save' && <ErrorBanner>{t.contentScript.saveFailed}</ErrorBanner>
          )}
          <div className={loadFailed ? 'opacity-60' : undefined}>
            <RatingOptions
              t={t}
              colors={colors}
              preview={preview}
              disabled={busy || !preview || selected !== undefined}
              onSave={save}
              selected={selected}
              allowUnrated={allowUnrated && !loadFailed}
            />
          </div>
        </>
      )}
      {/* Stays mounted across the saved swap, so Up next keeps its place and content. */}
      {reference && !loadFailed && (
        <NextProblems
          t={t}
          problem={reference}
          saved={!!saved}
          action={showSaved && youtube}
          pointerGuard={pointerGuard}
          className={showSaved ? undefined : 'mt-1.5'}
        />
      )}
      {!showSaved && session.error === 'settings' && (
        <div className="mt-1.5">
          <ErrorBanner>{t.contentScript.turnOffFailed}</ErrorBanner>
        </div>
      )}
      {!showSaved && hint && !loadFailed && (
        <div className="mt-1.5 flex h-10 items-center gap-1.5 border-t border-line px-3.5 text-[12px] text-fg-3">
          <span className="truncate">{t.contentScript.autoOpenHint}</span>
          <Button
            className="shrink-0 cursor-pointer rounded-sm font-medium text-fg-2 hover:underline data-focus-visible:outline-2 data-focus-visible:outline-focus data-focus-visible:outline-offset-2"
            aria-label={t.contentScript.turnOffAutoOpen}
            isDisabled={busy}
            onPress={() => {
              // The button disables while saving, so keep focus on the panel.
              container.current?.focus();
              void session.disableAutoOpen().then((disabled) => {
                if (disabled) setHint(false);
              });
            }}
          >
            {t.contentScript.turnOff}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function SavedView({
  t,
  saved,
  color,
  busy,
  onUndo,
}: {
  t: Translations;
  saved: SavedConfirmation;
  color: string | undefined;
  busy: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-3">
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full ${color ? '' : 'bg-raised text-fg-2'}`}
        style={color ? { background: `color-mix(in srgb, ${color} 16%, var(--ls-surface))`, color } : undefined}
        aria-hidden="true"
      >
        <LuCheck className="size-3.5" strokeWidth={2.4} />
      </span>
      <div role="status" className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold tracking-[-0.01em]">
          {saved.rating ? t.contentScript.savedAs(t.ratings[saved.rating]) : t.contentScript.saved}
        </div>
        {saved.rating && (
          <div className="truncate text-[12px] text-fg-3">
            {t.contentScript.reviewIn(saved.scheduledDays)} · {t.contentScript.reviewDate(new Date(saved.due))}
          </div>
        )}
      </div>
      {saved.undoToken && (
        <Button
          className="-mr-1.5 flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-fg-2 hover:bg-raised data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2 data-focus-visible:outline-focus"
          isDisabled={busy}
          onPress={onUndo}
        >
          <LuUndo2 className="size-3.5" aria-hidden="true" />
          {t.contentScript.undo}
        </Button>
      )}
    </div>
  );
}

function ErrorBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="mx-1.5 mb-1 flex items-start gap-2 rounded-lg bg-danger-soft px-2.5 py-2 text-[12px] leading-[1.4] text-danger"
    >
      <LuCircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

function formatStatus(status: CardStatus, t: Translations): string {
  if (status.paused) return t.cardsView.filters.paused;
  if (status.reps === 0) return t.cardsView.filters.new;
  return formatDue(status.due, Date.now(), t).label;
}
