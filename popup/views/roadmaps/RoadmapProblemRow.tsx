import { FaForwardStep, FaLock, FaRotateLeft } from 'react-icons/fa6';
import { type SavedProblem, SaveProblemButton } from '@/popup/components/problem-save/SaveProblemButton';
import { useI18n } from '@/popup/contexts/I18nContext';
import type { CatalogProblem } from '@/shared/catalog';
import type { Card } from '@/shared/learning-document';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { isReviewed } from '@/shared/roadmap';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { YouTubeLink } from '@/shared/ui/YouTubeLink';

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
  onSaved: (saved: SavedProblem) => void;
  onToggleSkip: () => void;
}

export function RoadmapProblemRow({ problem, domain, isSaving, onSaved, onToggleSkip }: RoadmapProblemRowProps) {
  const t = useI18n();
  const { frontendId, metadata, card, skipped } = problem;
  const title = metadata ? getProblemTitle(metadata, domain) : t.roadmaps.problem(frontendId);
  const available = metadata?.sources.includes(domain);
  let state: 'notInSrs' | 'inSrs' | 'reviewed' = 'notInSrs';
  if (card) state = isReviewed(card) ? 'reviewed' : 'inSrs';

  return (
    <li className="roadmap-problem">
      <div className="flex items-start gap-1 min-w-0">
        {metadata && available ? (
          <a
            className="text-sm hover:text-accent break-words min-w-0"
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-1 text-xs text-secondary">
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
        <div className="flex shrink-0 items-center gap-0.5 [&>a]:w-6">
          {available && (
            <SaveProblemButton
              frontendId={frontendId}
              domain={card?.domain ?? domain}
              title={title}
              isSaved={!!card}
              onSaved={onSaved}
            />
          )}
          <YouTubeLink url={metadata?.youtubeUrl} label={t.youtubeSolution} />
          <button
            type="button"
            className="roadmap-text-button inline-flex w-6 h-8 items-center justify-center"
            disabled={isSaving}
            aria-label={skipped ? t.roadmaps.restoreProblem(title) : t.roadmaps.skipProblem(title)}
            title={skipped ? t.roadmaps.restore : t.roadmaps.skip}
            onClick={onToggleSkip}
          >
            {skipped ? (
              <FaRotateLeft aria-hidden="true" className="size-4" />
            ) : (
              <FaForwardStep aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>
      {!available && <p className="text-xs text-secondary">{t.roadmaps.unavailable(domain)}</p>}
    </li>
  );
}
