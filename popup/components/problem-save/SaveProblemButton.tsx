import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { FaXmark } from 'react-icons/fa6';
import type { Grade } from 'ts-fsrs';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useTheme } from '@/popup/hooks/useTheme';
import { useAddCardMutation, useRateCardMutation } from '@/popup/queries/cards';
import { background } from '@/shared/background-service';
import type { ProblemReference } from '@/shared/models';
import { RatingOptions } from '@/shared/ui/RatingOptions';
import { RATING_COLORS } from '@/shared/ui/rating-colors';
import './problem-save.css';

interface SaveTarget extends ProblemReference {
  title: string;
  isSaved: boolean;
}

export interface SavedProblem {
  title: string;
  scheduledDays: number | null;
}

// Keep feedback above rows and suggestions that can disappear as soon as storage updates.
export function useProblemSaveFeedback() {
  const t = useI18n();
  const [saved, onSaved] = useState<SavedProblem>();
  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => onSaved(undefined), 5000);
    return () => clearTimeout(timeout);
  }, [saved]);
  return {
    onSaved,
    message: saved
      ? `${saved.title} · ${t.contentScript.saved}${saved.scheduledDays === null ? '' : ` · ${t.contentScript.reviewIn(saved.scheduledDays)}`}`
      : '',
  };
}

export function SaveProblemButton({
  variant = 'row',
  isDisabled = false,
  onSaved,
  ...problem
}: SaveTarget & { variant?: 'row' | 'card'; isDisabled?: boolean; onSaved: (saved: SavedProblem) => void }) {
  const t = useI18n();
  // Freeze the menu's problem while Home is recomputing its next suggestion.
  const [target, setTarget] = useState<SaveTarget | null>(null);
  const add = useAddCardMutation();
  const rate = useRateCardMutation();
  const pending = useRef(false);
  const busy = add.isPending || rate.isPending;

  function setOpen(open: boolean) {
    if (pending.current) return;
    if (open) {
      add.reset();
      rate.reset();
    }
    setTarget(open ? problem : null);
  }

  async function save(rating?: Grade) {
    if (!target || pending.current) return;
    pending.current = true;
    try {
      const reference = { frontendId: target.frontendId, domain: target.domain };
      let scheduledDays: number | null = null;
      if (rating === undefined) await add.mutateAsync(reference);
      else scheduledDays = (await rate.mutateAsync({ ...reference, rating })).fsrs.scheduled_days;
      onSaved({ title: target.title, scheduledDays });
      setTarget(null);
    } catch {
      // The mutation error stays in the open menu, where the user can retry.
    } finally {
      pending.current = false;
    }
  }

  return (
    <DialogTrigger isOpen={target !== null} onOpenChange={setOpen}>
      <Button
        className="problem-save-trigger"
        data-variant={variant}
        aria-label={t.problemSave.saveProblem(problem.title)}
        isDisabled={isDisabled || busy}
      >
        {t.actions.save}
      </Button>
      <Popover
        className="rating-panel problem-save-popover"
        placement={variant === 'card' ? 'bottom start' : 'bottom end'}
        offset={6}
        containerPadding={8}
        isKeyboardDismissDisabled={busy}
        shouldCloseOnInteractOutside={() => !pending.current}
      >
        {target && (
          <SaveProblemMenu
            target={target}
            busy={busy}
            failed={add.isError || rate.isError}
            onSave={save}
            onClose={() => setOpen(false)}
          />
        )}
      </Popover>
    </DialogTrigger>
  );
}

function SaveProblemMenu({
  target,
  busy,
  failed,
  onSave,
  onClose,
}: {
  target: SaveTarget;
  busy: boolean;
  failed: boolean;
  onSave: (rating?: Grade) => Promise<void>;
  onClose: () => void;
}) {
  const t = useI18n();
  const colors = RATING_COLORS[useTheme()];
  const { frontendId, domain } = target;
  const preview = useQuery({
    queryKey: ['popupRatingPreview', { frontendId, domain }],
    queryFn: () => background.previewRatings({ frontendId, domain }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <Dialog
      className="outline-none"
      aria-busy={busy || preview.isFetching}
      aria-label={t.problemSave.saveProblem(target.title)}
    >
      <div className="rating-heading gap-2">
        <div className="min-w-0">
          <Heading slot="title" className="font-medium">
            {t.contentScript.howDidItGo}
          </Heading>
          <p className="mt-0.5 break-words text-secondary text-[11px]">
            {frontendId}. {target.title}
          </p>
        </div>
        <Button
          className="flex items-center justify-center shrink-0 size-6 -mt-1 -mr-1 rounded text-secondary hover:bg-secondary"
          aria-label={t.problemSave.close}
          isDisabled={busy}
          onPress={onClose}
        >
          <FaXmark aria-hidden="true" />
        </Button>
      </div>
      <RatingOptions
        t={t}
        colors={colors}
        preview={preview.isFetching || preview.isError ? undefined : preview.data}
        disabled={busy}
        onSave={onSave}
        allowUnrated={!target.isSaved}
      />
      {busy && (
        <p className="rating-error" role="status">
          {t.actions.saving}
        </p>
      )}
      {preview.isError && (
        <div className="rating-error text-danger" role="alert">
          {t.problemSave.previewFailed}{' '}
          <Button className="underline" isDisabled={busy || preview.isFetching} onPress={() => void preview.refetch()}>
            {t.contentScript.retry}
          </Button>
        </div>
      )}
      {failed && (
        <p className="rating-error text-danger" role="alert">
          {t.contentScript.saveFailed}
        </p>
      )}
    </Dialog>
  );
}
