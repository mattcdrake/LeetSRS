import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Grade } from 'ts-fsrs';
import { getCurrentProblemReference } from '@/content/current-problem';
import { background } from '@/shared/background-service';
import type { Translations } from '@/shared/i18n/index';
import { type ProblemReference, type RatingPreview, ratingSchema } from '@/shared/models';
import { THEME_COLORS, useDarkMode } from './theme';
import type { useRatingSession } from './useRatingSession';

export function RatingMenu({ t, session }: { t: Translations; session: ReturnType<typeof useRatingSession> }) {
  const { saved, busy } = session;
  const dark = useDarkMode();
  const colors = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  const [problem, setProblem] = useState<ProblemReference>();
  const [preview, setPreview] = useState<RatingPreview>();
  const [hint, setHint] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const error = session.error ?? (loadFailed ? 'save' : undefined);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLFieldSetElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and Undo refresh the preview.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const problem = await getCurrentProblemReference();
        const preview = await background.previewRatings(problem);
        if (!active) return;
        setProblem(problem);
        setPreview(preview);
        const showHint = await background.getRatingHint();
        if (active) setHint(showHint);
      } catch {
        if (active) setLoadFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (hint && !saved) void background.markRatingHintShown().catch(() => setLoadFailed(true));
  }, [hint, saved]);

  function save(rating?: Grade) {
    if (!problem || !preview || saved) return;
    session.save({ ...problem, rating });
  }

  useEffect(() => {
    if (saved) container.current?.querySelector<HTMLButtonElement>('button')?.focus();
    else container.current?.focus();
  }, [saved]);

  return (
    <fieldset
      ref={container}
      tabIndex={-1}
      className="rating-panel"
      data-theme={dark ? 'dark' : 'light'}
      aria-busy={busy}
      style={
        {
          '--panel-bg': dark ? '#242424' : '#ffffff',
          '--panel-text': colors.textAddButton,
          '--panel-muted': dark ? '#a8a8a8' : '#737373',
          '--panel-border': colors.borderMenu,
          '--focus-ring': colors.focusRing,
        } as CSSProperties
      }
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
        const rating = ratingSchema.safeParse(Number(event.key));
        if (rating.success || event.key === '5') {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) save(rating.success ? rating.data : undefined);
        }
      }}
    >
      {saved ? (
        <div className="rating-saved">
          <span aria-hidden="true" style={{ color: colors.ratings[4].bg }}>
            ✓
          </span>
          <span role="status">
            {t.contentScript.saved}
            {saved.scheduledDays !== null && ` · ${t.contentScript.reviewIn(saved.scheduledDays)}`}
          </span>
          <Button
            isDisabled={busy}
            onPress={() =>
              void session.undo().then((undone) => {
                if (undone) setAttempt((value) => value + 1);
              })
            }
          >
            {t.contentScript.undo}
          </Button>
        </div>
      ) : (
        <>
          <div className="rating-heading">
            <span>{t.contentScript.howDidItGo}</span>
            <span className="rating-wordmark">
              Leet<span style={{ color: colors.ratings[4].bg }}>SRS</span>
            </span>
          </div>
          <div className="rating-options">
            {[...ratingSchema.values].map((rating) => (
              <Button
                key={rating}
                aria-label={t.ratings[rating]}
                aria-describedby={`rating-description-${rating}`}
                className="rating-row"
                isDisabled={busy || !preview}
                onPress={() => save(rating)}
                style={{ '--rating-color': colors.ratings[rating].bg } as CSSProperties}
              >
                <span className="rating-stripe" aria-hidden="true" />
                <span className="rating-label">
                  {t.ratings[rating]}
                  <small id={`rating-description-${rating}`}>{t.contentScript.descriptions[rating]}</small>
                </span>
                <span className="rating-interval">{preview ? t.contentScript.days(preview[rating]) : '…'}</span>
                <kbd>{rating}</kbd>
              </Button>
            ))}
          </div>
          <Button
            className="rating-without"
            aria-label={t.contentScript.saveWithoutRating}
            isDisabled={busy || !preview}
            onPress={() => save()}
          >
            <span aria-hidden="true">+</span>
            <span>{t.contentScript.saveWithoutRating}</span>
            <kbd>5</kbd>
          </Button>
          {hint && (
            <div className="rating-hint">
              <p>{t.contentScript.autoOpenHint}</p>
              <Button
                isDisabled={busy}
                onPress={() =>
                  void session.disableAutoOpen().then((disabled) => {
                    if (disabled) setHint(false);
                  })
                }
              >
                {t.contentScript.turnOffAutoOpen}
              </Button>
            </div>
          )}
        </>
      )}
      {error && (
        <div className="rating-error" role="alert">
          {error === 'undo' ? t.contentScript.undoFailed : t.contentScript.saveFailed}
          {!preview && (
            <Button
              onPress={() => {
                setLoadFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              {t.contentScript.retry}
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}
