import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { LuPlus, LuX } from 'react-icons/lu';
import type { Grade } from 'ts-fsrs';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useTheme } from '@/popup/hooks/useTheme';
import { ratingPreviewQueryOptions, useAddCardMutation, useRateCardMutation } from '@/popup/queries/cards';
import type { ProblemReference } from '@/shared/learning-document';
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
}: SaveTarget & {
  variant?: 'row' | 'card' | 'primary';
  isDisabled?: boolean;
  onSaved: (saved: SavedProblem) => void;
}) {
  const t = useI18n();
  const save = useSaveProblem(onSaved);

  return (
    <DialogTrigger isOpen={save.target !== null} onOpenChange={(open) => save.open(open ? problem : null)}>
      <Button
        className="problem-save-trigger"
        data-variant={variant}
        aria-label={t.problemSave.saveProblem(problem.title)}
        isDisabled={isDisabled || save.busy}
      >
        {variant === 'primary' && <LuPlus aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
        {t.actions.save}
      </Button>
      <SaveProblemSheet save={save} />
    </DialogTrigger>
  );
}

export type SaveProblemState = ReturnType<typeof useSaveProblem>;

// Holds the rating sheet's state so a trigger other than SaveProblemButton can open it.
export function useSaveProblem(onSaved: (saved: SavedProblem) => void) {
  // Freeze the menu's problem while Home is recomputing its next suggestion.
  const [target, setTarget] = useState<SaveTarget | null>(null);
  const add = useAddCardMutation();
  const rate = useRateCardMutation();
  const pending = useRef(false);
  const busy = add.isPending || rate.isPending;

  function open(problem: SaveTarget | null) {
    if (pending.current) return;
    if (problem) {
      add.reset();
      rate.reset();
    }
    setTarget(problem);
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

  return { target, open, save, busy, failed: add.isError || rate.isError, pending };
}

export function SaveProblemSheet({ save }: { save: SaveProblemState }) {
  const { target, busy, pending } = save;
  return (
    <ModalOverlay
      className="problem-save-overlay"
      isOpen={target !== null}
      onOpenChange={(open) => !open && save.open(null)}
      isDismissable
      isKeyboardDismissDisabled={busy}
      shouldCloseOnInteractOutside={() => !pending.current}
    >
      <Modal className="problem-save-sheet">
        {target && (
          <SaveProblemMenu
            target={target}
            busy={busy}
            failed={save.failed}
            onSave={save.save}
            onClose={() => save.open(null)}
          />
        )}
      </Modal>
    </ModalOverlay>
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
  const preview = useQuery(ratingPreviewQueryOptions({ frontendId, domain }));

  return (
    <Dialog
      className="outline-none"
      aria-busy={busy || preview.isFetching}
      aria-label={t.problemSave.saveProblem(target.title)}
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-8 rounded-full bg-[var(--current-border-strong)]" />
      <div className="flex items-start gap-3 px-4 pt-2.5 pb-3">
        <div className="min-w-0 flex-1">
          <Heading slot="title" className="text-[15px] font-semibold tracking-[-0.01em]">
            {t.contentScript.howDidItGo}
          </Heading>
          <p className="mt-0.5 truncate text-xs text-tertiary">
            <span className="tabular-nums">{frontendId}.</span> {target.title}
          </p>
        </div>
        <Button
          className="grid place-items-center shrink-0 size-7 -mr-1.5 rounded-md text-tertiary hover:bg-secondary"
          aria-label={t.problemSave.close}
          isDisabled={busy}
          onPress={onClose}
        >
          <LuX aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <RatingOptions
        t={t}
        colors={colors}
        preview={preview.isFetching || preview.isError ? undefined : preview.data}
        disabled={busy}
        onSave={onSave}
        allowUnrated={!target.isSaved}
        size="comfortable"
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
