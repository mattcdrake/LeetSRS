import type { ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { LuEllipsis, LuGlobe, LuLock, LuRotateCcw, LuSkipForward, LuUndo2, LuYoutube } from 'react-icons/lu';
import { Difficulty } from '@/popup/components/Difficulty';
import { type SavedProblem, SaveProblemButton } from '@/popup/components/problem-save/SaveProblemButton';
import { Tooltip } from '@/popup/components/Tooltip';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction, menuItem, menuPopover } from '@/popup/styles';
import { addLocalDays, isDue } from '@/shared/calendar';
import type { CatalogProblem } from '@/shared/catalog';
import type { Card, ProblemReference } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { isReviewed } from '@/shared/roadmap';
import { getProblemTitle } from '@/shared/ui/problem-title';

export interface RoadmapProblem {
  frontendId: string;
  metadata: CatalogProblem | undefined;
  card: Card | undefined;
  skipped: boolean;
}

type ProblemState = 'notInSrs' | 'inSrs' | 'reviewed' | 'skipped';

interface RoadmapProblemRowProps {
  problem: RoadmapProblem;
  domain: LeetcodeDomain;
  now: number;
  isNext: boolean;
  isSkipping: boolean;
  onSaved: (saved: SavedProblem) => void;
  onToggleSkip: () => void;
  onRateAgain: (target: ProblemReference & { title: string }) => void;
}

export function RoadmapProblemRow({
  problem,
  domain,
  now,
  isNext,
  isSkipping,
  onSaved,
  onToggleSkip,
  onRateAgain,
}: RoadmapProblemRowProps) {
  const t = useI18n();
  const { frontendId, metadata, card, skipped } = problem;
  const title = metadata ? getProblemTitle(metadata, domain) : t.roadmaps.problem(frontendId);
  const available = !!metadata?.sources.includes(domain);
  let srsState: Exclude<ProblemState, 'skipped'> = 'notInSrs';
  if (card) srsState = isReviewed(card) ? 'reviewed' : 'inSrs';
  // A skipped problem can also be in SRS; the glyph shows the skip.
  const state: ProblemState = skipped ? 'skipped' : srsState;

  const label = (
    <>
      {metadata && <span className="shrink-0 text-tertiary tabular-nums">{frontendId}.</span>}
      <span className="truncate">{title}</span>
    </>
  );

  return (
    <li className="flex min-h-12 items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition-colors duration-[120ms] hover:bg-[color-mix(in_srgb,var(--current-bg-secondary)_70%,transparent)]">
      <StatusGlyph state={state} />
      <div className="min-w-0 flex-1">
        <div
          className={`flex min-w-0 items-center gap-1 text-[13px] leading-[18px] ${skipped ? 'text-secondary' : ''}`}
        >
          <span className="sr-only">{t.roadmaps.filters[state]}</span>
          {metadata && available ? (
            <a
              className={`flex min-w-0 items-center gap-1 rounded-sm hover:text-accent ${buttonInteraction}`}
              href={getLeetcodeProblemUrl({ domain, slug: metadata.slug })}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${frontendId}. ${title}`}
            >
              {label}
            </a>
          ) : (
            <span className="flex min-w-0 items-center gap-1">{label}</span>
          )}
          {metadata?.isPaidOnly && (
            <LuLock
              className="size-3 shrink-0 text-tertiary"
              strokeWidth={2}
              role="img"
              aria-label={t.roadmaps.paidOnly}
            />
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-4">
          {available ? (
            <>
              {metadata && <Difficulty difficulty={metadata.difficulty} />}
              {card &&
                (srsState === 'reviewed' ? (
                  <MetaItem className="text-tertiary">{formatDue(card.fsrs.due, now, t)}</MetaItem>
                ) : (
                  <MetaItem className="text-accent">{t.roadmaps.new}</MetaItem>
                ))}
              {skipped && <MetaItem className="text-tertiary">{t.roadmaps.filters.skipped}</MetaItem>}
              {isNext && (
                <span className="ml-1 px-1 rounded bg-accent-soft text-accent text-[11px] font-medium leading-4">
                  {t.roadmaps.next}
                </span>
              )}
            </>
          ) : (
            <span className="flex min-w-0 items-center gap-1 text-tertiary">
              <LuGlobe aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{t.roadmaps.unavailable(domain)}</span>
            </span>
          )}
        </div>
      </div>
      {skipped ? (
        <Button
          className={`h-8 px-2 shrink-0 rounded-md flex items-center gap-1 text-xs text-secondary duration-[120ms] hover:bg-tertiary hover:text-primary ${buttonInteraction}`}
          aria-label={t.roadmaps.restoreProblem(title)}
          isDisabled={isSkipping}
          onPress={onToggleSkip}
        >
          <LuUndo2 aria-hidden="true" className="size-3.5" />
          {t.roadmaps.restore}
        </Button>
      ) : (
        !card &&
        available && (
          <SaveProblemButton
            frontendId={frontendId}
            domain={domain}
            title={title}
            isSaved={false}
            variant="card"
            onSaved={onSaved}
          />
        )
      )}
      <RowMenu
        title={title}
        youtubeUrl={metadata?.youtubeUrl}
        isSkipping={isSkipping}
        onSkip={skipped ? undefined : onToggleSkip}
        onRateAgain={card && (() => onRateAgain({ frontendId, domain: card.domain, title }))}
      />
    </li>
  );
}

function MetaItem({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span aria-hidden="true">·</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function formatDue(due: number, now: number, t: ReturnType<typeof useI18n>) {
  const today = new Date(now);
  if (isDue(due, today)) return t.roadmaps.dueToday;
  // Round calendar-day differences so DST changes do not shift the count.
  const days = Math.round((addLocalDays(new Date(due), 0).getTime() - addLocalDays(today, 0).getTime()) / 86_400_000);
  return t.roadmaps.dueIn(t.format.intervalShort(days));
}

function RowMenu({
  title,
  youtubeUrl,
  isSkipping,
  onSkip,
  onRateAgain,
}: {
  title: string;
  youtubeUrl: string | undefined;
  isSkipping: boolean;
  onSkip: (() => void) | undefined;
  onRateAgain: (() => void) | undefined;
}) {
  const t = useI18n();
  if (!youtubeUrl && !onSkip && !onRateAgain) {
    // Keep trailing actions aligned with rows that have a menu.
    return <span aria-hidden="true" className="size-8 -mr-1 shrink-0" />;
  }

  return (
    <MenuTrigger>
      <Tooltip label={t.roadmaps.more}>
        <Button
          aria-label={t.roadmaps.moreActions(title)}
          className={`size-8 -mr-1 shrink-0 rounded-md grid place-items-center text-tertiary duration-[120ms] hover:bg-tertiary hover:text-primary data-[pressed]:bg-tertiary ${buttonInteraction}`}
        >
          <LuEllipsis aria-hidden="true" className="size-4" />
        </Button>
      </Tooltip>
      <Popover placement="bottom end" offset={4} className={menuPopover}>
        <Menu className="outline-none">
          {youtubeUrl && (
            <MenuItem className={menuItem} href={youtubeUrl} target="_blank" rel="noopener noreferrer">
              <LuYoutube aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
              {t.roadmaps.watchSolution}
            </MenuItem>
          )}
          {onSkip && (
            <MenuItem className={menuItem} isDisabled={isSkipping} onAction={onSkip}>
              <LuSkipForward aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
              {t.roadmaps.skip}
            </MenuItem>
          )}
          {onRateAgain && (
            <MenuItem className={menuItem} onAction={onRateAgain}>
              <LuRotateCcw aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
              {t.roadmaps.rateAgain}
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function StatusGlyph({ state }: { state: ProblemState }) {
  if (state === 'skipped') {
    return (
      <svg aria-hidden="true" className="size-4 shrink-0 text-tertiary" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2.2" />
      </svg>
    );
  }
  if (state === 'reviewed') {
    return (
      <svg aria-hidden="true" className="size-4 shrink-0 text-accent" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path
          d="m5 8.2 2 2 4-4.2"
          fill="none"
          stroke="var(--current-on-accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === 'inSrs') {
    return (
      <svg aria-hidden="true" className="size-4 shrink-0 text-accent" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="2.75" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="size-4 shrink-0 text-tertiary" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
    </svg>
  );
}
