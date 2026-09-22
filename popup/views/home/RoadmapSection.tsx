import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { FaArrowUp, FaForwardStep, FaLock } from 'react-icons/fa6';
import { SaveProblemButton, useProblemSaveFeedback } from '@/popup/components/problem-save/SaveProblemButton';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import {
  activeRoadmapQueryOptions,
  roadmapMetadataQueryOptions,
  roadmapsQueryOptions,
  useSkipRoadmapProblemMutation,
} from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { buttonInteraction } from '@/popup/styles';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getNextRoadmapProblemId, type Roadmap, type RoadmapId } from '@/shared/roadmap';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';

export function RoadmapSection({ onOpen }: { onOpen: (id: RoadmapId) => void }) {
  const t = useI18n();
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const roadmaps = useQuery({ ...roadmapsQueryOptions, enabled: activeRoadmapId !== null });

  if (!activeRoadmapId) return null;

  const roadmap = roadmaps.data?.find((roadmap) => roadmap.id === activeRoadmapId);
  return (
    <section aria-label={t.home.currentRoadmap} className="pt-3 border-t border-current flex flex-col gap-3">
      {roadmaps.isPending ? (
        <p role="status" className="text-sm text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : roadmaps.isError ? (
        <div role="alert" className="text-sm">
          <p>{t.roadmaps.loadFailed}</p>
          <button type="button" className={`text-accent ${buttonInteraction}`} onClick={() => void roadmaps.refetch()}>
            {t.roadmaps.retry}
          </button>
        </div>
      ) : roadmap ? (
        <ActiveRoadmap roadmap={roadmap} onOpen={() => onOpen(roadmap.id)} />
      ) : null}
    </section>
  );
}

function ActiveRoadmap({ roadmap, onOpen }: { roadmap: Roadmap & { id: RoadmapId }; onOpen: () => void }) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const skip = useSkipRoadmapProblemMutation();
  const ids = roadmap.groups.flatMap((group) => group.frontendIds);
  const reviewed = ids.filter((id) => document.cards[id]?.fsrs.reps > 0).length;
  const nextId = getNextRoadmapProblemId(roadmap, document, metadata.data, domain);
  const next = nextId ? metadata.data?.[nextId] : undefined;
  const { message, onSaved } = useProblemSaveFeedback();

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-2">
          <h2 className="text-[10px] font-medium uppercase text-secondary">{t.home.currentRoadmap}</h2>
          <p className="text-sm font-medium">{roadmap.name}</p>
          <p className="text-xs text-secondary">{t.home.roadmapReviewed(reviewed, ids.length)}</p>
        </div>
        <button type="button" className={`shrink-0 text-xs text-accent ${buttonInteraction}`} onClick={onOpen}>
          {t.home.viewRoadmap}
        </button>
      </div>
      {metadata.isPending ? (
        <p role="status" className="text-sm text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : metadata.isError ? (
        <div role="alert" className="text-sm">
          <p>{t.roadmaps.detailLoadFailed}</p>
          <button type="button" className={`text-accent ${buttonInteraction}`} onClick={() => void metadata.refetch()}>
            {t.roadmaps.retry}
          </button>
        </div>
      ) : next ? (
        <div className="rounded-lg border border-current p-3 flex flex-col gap-2">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase text-secondary">{t.home.nextProblem}</span>
            <span className="text-[11px] capitalize" style={{ color: DIFFICULTY_COLORS[next.difficulty] }}>
              {next.difficulty}
            </span>
          </span>
          <a
            className={`flex items-start gap-2 text-[13px] font-medium hover:text-accent ${buttonInteraction}`}
            href={getLeetcodeProblemUrl({ domain, slug: next.slug })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${next.frontendId}. ${getProblemTitle(next, domain)}`}
          >
            <span className="min-w-0 flex-1 break-words">
              {next.frontendId}. {getProblemTitle(next, domain)}
            </span>
            {next.isPaidOnly && (
              <FaLock className="shrink-0 mt-1 text-secondary text-xs" role="img" aria-label={t.roadmaps.paidOnly} />
            )}
            <FaArrowUp aria-hidden="true" className="shrink-0 mt-1 rotate-45 text-xs" />
          </a>
          <div className="flex items-center gap-2">
            <SaveProblemButton
              frontendId={next.frontendId}
              domain={domain}
              title={getProblemTitle(next, domain)}
              isSaved={false}
              variant="card"
              isDisabled={skip.isPending}
              onSaved={onSaved}
            />
            <button
              type="button"
              className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary hover:text-accent ${buttonInteraction}`}
              disabled={skip.isPending}
              aria-label={t.roadmaps.skipProblem(getProblemTitle(next, domain))}
              title={t.roadmaps.skip}
              onClick={() => skip.mutate({ roadmapId: roadmap.id, frontendId: next.frontendId, skipped: true })}
            >
              <FaForwardStep aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-secondary">{t.home.noNextProblem(domain)}</p>
      )}
      {skip.isError && (
        <p role="alert" className="text-xs text-danger">
          {t.roadmaps.skipFailed}
        </p>
      )}
      <p role="status" className="text-xs text-accent empty:hidden">
        {message}
      </p>
    </>
  );
}
