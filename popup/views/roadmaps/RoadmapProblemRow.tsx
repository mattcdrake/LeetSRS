import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { FaForwardStep, FaLock, FaPlus, FaRotateLeft } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { CatalogProblem } from '@/shared/catalog';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { Card, LeetcodeDomain } from '@/shared/models';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';

export interface RoadmapProblem {
  frontendId: string;
  metadata: CatalogProblem | undefined;
  card: Card | undefined;
  skipped: boolean;
}

interface RoadmapProblemRowProps {
  problem: RoadmapProblem;
  domain: LeetcodeDomain;
  isSaving: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onToggleSkip: () => void;
}

export function RoadmapProblemRow({
  problem,
  domain,
  isSaving,
  isAdding,
  onAdd,
  onToggleSkip,
}: RoadmapProblemRowProps) {
  const t = useI18n();
  const { frontendId, metadata, card, skipped } = problem;
  const title = metadata ? getProblemTitle(metadata, domain) : t.roadmaps.problem(frontendId);
  const available = metadata?.sources.includes(domain);
  let state: 'notInSrs' | 'inSrs' | 'reviewed' = 'notInSrs';
  if (card) {
    state = card.fsrs.reps > 0 ? 'reviewed' : 'inSrs';
  }

  return (
    <li className="roadmap-problem">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          {metadata && available ? (
            <a
              className="text-sm hover:text-accent break-words"
              href={getLeetcodeProblemUrl({ domain, slug: metadata.slug })}
              target="_blank"
              rel="noopener noreferrer"
            >
              {frontendId}. {title}
            </a>
          ) : (
            <span className="text-sm break-words">{metadata ? `${frontendId}. ${title}` : title}</span>
          )}
          {metadata?.isPaidOnly && (
            <FaLock className="shrink-0 mt-1 text-secondary text-xs" role="img" aria-label={t.roadmaps.paidOnly} />
          )}
        </div>
        <div className="flex flex-wrap gap-x-1 text-xs text-secondary mt-1">
          {metadata && (
            <>
              <span className="capitalize" style={{ color: DIFFICULTY_COLORS[metadata.difficulty] }}>
                {metadata.difficulty}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{t.roadmaps.filters[state]}</span>
          {skipped && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t.roadmaps.filters.skipped}</span>
            </>
          )}
        </div>
        {!available && <p className="text-xs text-secondary mt-1">{t.roadmaps.unavailable(domain)}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        {!card && available && (
          <TooltipTrigger delay={350} closeDelay={0}>
            <Button
              className="roadmap-text-button inline-flex size-8 items-center justify-center"
              isDisabled={isAdding}
              aria-label={t.roadmaps.addProblem(title)}
              onPress={onAdd}
            >
              <FaPlus aria-hidden="true" className="text-sm" />
            </Button>
            <Tooltip
              placement="top"
              className="z-[1100] rounded-lg border border-current bg-primary px-2 py-1 text-xs text-primary shadow-lg"
            >
              {t.roadmaps.add}
            </Tooltip>
          </TooltipTrigger>
        )}
        <button
          type="button"
          className="roadmap-text-button inline-flex size-8 items-center justify-center"
          disabled={isSaving}
          aria-label={skipped ? t.roadmaps.restoreProblem(title) : t.roadmaps.skipProblem(title)}
          title={skipped ? t.roadmaps.restore : t.roadmaps.skip}
          onClick={onToggleSkip}
        >
          {skipped ? (
            <FaRotateLeft aria-hidden="true" className="text-sm" />
          ) : (
            <FaForwardStep aria-hidden="true" className="text-sm" />
          )}
        </button>
      </div>
    </li>
  );
}
