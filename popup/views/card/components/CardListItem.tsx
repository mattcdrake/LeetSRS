import { type ReactNode, useId, useState } from 'react';
import { Button, Link } from 'react-aria-components';
import { LuArrowUpRight, LuChevronRight, LuNotebookPen, LuPause, LuPlay, LuTrash2, LuYoutube } from 'react-icons/lu';
import { State as FsrsState } from 'ts-fsrs';
import { Difficulty } from '@/popup/components/Difficulty';
import { MetaItem } from '@/popup/components/MetaItem';
import { NoteEditor } from '@/popup/components/notes/NoteEditor';
import { Tooltip } from '@/popup/components/Tooltip';
import { useTimedConfirmation } from '@/popup/hooks/useTimedConfirmation';
import type { CardWithProblem } from '@/popup/queries/cards';
import { usePauseCardMutation, useRemoveCardMutation } from '@/popup/queries/cards';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction, iconButton, textButton } from '@/popup/styles';
import { localDaysUntil } from '@/shared/calendar';
import { formatDue } from '@/shared/due';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { useI18n } from '../../../contexts/I18nContext';

interface CardListItemProps {
  card: CardWithProblem;
  now: number;
}

export function CardListItem({ card, now }: CardListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useI18n();
  const panelId = useId();
  const title = getProblemTitle(card, card.domain);

  const row = (
    <div
      className={`flex min-h-12 items-center gap-1 px-2 rounded-lg ${
        isExpanded
          ? ''
          : '-mx-2 transition-colors duration-[120ms] hover:bg-[color-mix(in_srgb,var(--current-bg-secondary)_70%,transparent)]'
      }`}
    >
      <Button
        className={`min-w-0 flex-1 flex items-center gap-2 py-1.5 text-left rounded-md ${buttonInteraction}`}
        onPress={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? panelId : undefined}
      >
        <LuChevronRight
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-tertiary transition-transform duration-[120ms] ${isExpanded ? 'rotate-90' : ''}`}
          strokeWidth={2}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`flex min-w-0 items-center gap-1 text-[13px] leading-[18px] ${card.paused ? 'text-secondary' : 'text-primary'}`}
          >
            <span className="shrink-0 text-tertiary tabular-nums">{card.frontendId}.</span>
            <span className={`truncate ${isExpanded ? 'font-medium' : ''}`}>{title}</span>
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-4">
            <Difficulty difficulty={card.difficulty} tone="quiet" />
            <DueStatus card={card} now={now} />
            {(card.fsrs.state === FsrsState.Learning || card.fsrs.state === FsrsState.Relearning) && (
              <MetaItem className="text-tertiary">
                {card.fsrs.state === FsrsState.Learning ? t.states.learning : t.states.relearning}
              </MetaItem>
            )}
            {card.note && (
              <span className="ml-0.5 shrink-0 text-tertiary">
                <LuNotebookPen aria-hidden="true" className="size-3" />
                <span className="sr-only">{t.cardsView.hasNote}</span>
              </span>
            )}
          </span>
        </span>
      </Button>
      <Link
        href={getLeetcodeProblemUrl(card)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.cardsView.openOnLeetcode(title)}
        className={`size-8 -mr-1 shrink-0 rounded-md grid place-items-center text-tertiary duration-[120ms] hover:bg-tertiary hover:text-primary ${buttonInteraction}`}
      >
        <LuArrowUpRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </Link>
    </div>
  );

  if (!isExpanded) return row;

  return (
    <div className="-mx-2 rounded-xl bg-surface border border-current shadow-card">
      {row}
      <CardDetails id={panelId} card={card} now={now} />
    </div>
  );
}

function DueStatus({ card, now }: { card: CardWithProblem; now: number }) {
  const t = useI18n();
  if (card.paused) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-tertiary">
        <span aria-hidden="true">·</span>
        <LuPause aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">{t.cardsView.paused}</span>
      </span>
    );
  }
  if (card.fsrs.state === FsrsState.New) return <MetaItem className="text-accent">{t.states.new}</MetaItem>;
  const { tone, label } = formatDue(card.fsrs.due, now, t);
  const className = {
    overdue: 'text-[var(--warning-text)]',
    today: 'text-primary font-medium',
    upcoming: 'text-tertiary',
  }[tone];
  return <MetaItem className={className}>{label}</MetaItem>;
}

function CardDetails({ id, card, now }: { id: string; card: CardWithProblem; now: number }) {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const pauseCardMutation = usePauseCardMutation();
  const removeCardMutation = useRemoveCardMutation();
  const { isConfirming, startOrConfirm } = useTimedConfirmation();
  const formatDate = (date: number) => formatShortDate(date, settings.language, now);
  const isOverdue = localDaysUntil(card.fsrs.due, new Date(now)) < 0;
  const deleteLabel = isConfirming ? t.actions.confirmDelete : t.cardsView.deleteCard;

  const handlePauseToggle = async () => {
    try {
      await pauseCardMutation.mutateAsync({ frontendId: card.frontendId, paused: !card.paused });
    } catch (error) {
      console.error('Failed to toggle pause status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await removeCardMutation.mutateAsync(card.frontendId);
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  const details = [
    ...(card.fsrs.state === FsrsState.New
      ? []
      : [
          `${t.cardStats.stability} ${t.format.stabilityDays(card.fsrs.stability.toFixed(1))}`,
          `${t.cardStats.difficulty} ${card.fsrs.difficulty.toFixed(1)}`,
        ]),
    `${t.cardStats.added} ${formatDate(card.createdAt)}`,
  ];

  return (
    <div id={id} className="px-3 pb-2">
      <dl className="grid grid-cols-4 gap-2 pl-[22px] pt-0.5">
        <Fact label={t.cardStats.nextReview} className={isOverdue && !card.paused ? 'text-[var(--warning-text)]' : ''}>
          {formatDate(card.fsrs.due)}
        </Fact>
        <Fact label={t.cardStats.lastReview}>
          {card.fsrs.last_review === undefined ? (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">{t.cardStats.never}</span>
            </>
          ) : (
            formatDate(card.fsrs.last_review)
          )}
        </Fact>
        <Fact label={t.cardStats.reviews}>{card.fsrs.reps}</Fact>
        <Fact label={t.cardStats.lapses}>{card.fsrs.lapses}</Fact>
      </dl>
      <p className="mt-2 pl-[22px] text-[11px] leading-4 text-tertiary tabular-nums">{details.join(' · ')}</p>

      <div className="mt-2.5 pt-1.5 border-t border-current flex items-center gap-0.5 -mx-1.5 text-xs text-secondary">
        {card.youtubeUrl && (
          <Link
            href={card.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.youtubeSolution}
            className={`${textButton} hover:bg-secondary hover:text-primary`}
          >
            <LuYoutube aria-hidden="true" className="size-3.5 shrink-0" />
            {t.cardsView.solution}
          </Link>
        )}
        <Button
          className={`${textButton} hover:bg-secondary hover:text-primary`}
          onPress={handlePauseToggle}
          isDisabled={pauseCardMutation.isPending}
        >
          {card.paused ? (
            <LuPlay aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <LuPause aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          {card.paused ? t.actions.resume : t.actions.pause}
        </Button>
        <span className="flex-1" />
        <Tooltip label={deleteLabel} isDisabled={isConfirming}>
          <Button
            className={
              isConfirming ? `${textButton} bg-danger text-white hover:opacity-90` : `${iconButton} hover:text-danger`
            }
            aria-label={deleteLabel}
            onPress={() => startOrConfirm(handleDelete)}
            isDisabled={removeCardMutation.isPending}
          >
            <LuTrash2 aria-hidden="true" className="size-3.5 shrink-0" />
            {isConfirming && deleteLabel}
          </Button>
        </Tooltip>
      </div>

      <div className="mt-1">
        <NoteEditor frontendId={card.frontendId} variant="compact" />
      </div>
    </div>
  );
}

function Fact({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] leading-4 text-tertiary">{label}</dt>
      <dd className={`truncate text-[13px] leading-[18px] font-medium tabular-nums ${className}`}>{children}</dd>
    </div>
  );
}

// "Sep 22" or "9月22日", with the year only when it differs from the current one.
function formatShortDate(date: number, language: string, now: number) {
  const value = new Date(date);
  const sameYear = value.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(value);
}
