import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Grade } from 'ts-fsrs';
import { getCurrentProblemReference } from '@/content/rating-actions';
import { background } from '@/shared/background-service';
import type { Translations } from '@/shared/i18n/index';
import { type PanelSave, type ProblemReference, type RatingPreview, ratingSchema } from '@/shared/models';
import { THEME_COLORS, useDarkMode } from './theme';

export function RatingMenu({ t }: { t: Translations }) {
  const dark = useDarkMode();
  const colors = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  const [problem, setProblem] = useState<ProblemReference>();
  const [preview, setPreview] = useState<RatingPreview>();
  const [saved, setSaved] = useState<PanelSave>();
  const [hint, setHint] = useState(false);
  const [error, setError] = useState<'save' | 'undo'>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    container.current?.focus();
  }, []);

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
        const showHint = await background.claimRatingHint();
        if (active) setHint(showHint);
      } catch {
        if (active) setError('save');
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  async function run(action: () => Promise<void>, failure: 'save' | 'undo' = 'save') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function save(rating?: Grade) {
    if (!problem || !preview || saved) return;
    void run(async () => setSaved(await background.savePanelRating({ ...problem, rating })));
  }

  useEffect(() => {
    if (saved) container.current?.querySelector<HTMLButtonElement>('button')?.focus();
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
              void run(async () => {
                await background.undoPanelRating(saved.undo);
                setSaved(undefined);
                setAttempt((value) => value + 1);
              }, 'undo')
            }
          >
            {t.contentScript.undo}
          </Button>
        </div>
      ) : (
        <>
          <div className="rating-heading">
            <span>{t.contentScript.howDidItGo}</span>
            <span>{t.contentScript.nextReview}</span>
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
                  void run(async () => {
                    await background.updateSettings({ openRatingAfterSolving: false });
                    setHint(false);
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
                setError(undefined);
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
