import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { LuArrowUpRight, LuChevronRight, LuLock, LuRoute, LuSkipForward } from 'react-icons/lu';
import { Difficulty } from '@/popup/components/Difficulty';
import { SaveProblemButton, useProblemSaveFeedback } from '@/popup/components/problem-save/SaveProblemButton';
import { QueryState } from '@/popup/components/QueryState';
import { RoadmapProgress } from '@/popup/components/RoadmapProgress';
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
import {
  getNextRoadmapProblemId,
  type Roadmap,
  type RoadmapId,
  roadmapProblemIds,
  summarizeRoadmap,
} from '@/shared/roadmap';
import { getProblemTitle } from '@/shared/ui/problem-title';

export function RoadmapSection({ isQueueEmpty, onOpen }: { isQueueEmpty: boolean; onOpen: (id: RoadmapId) => void }) {
  const t = useI18n();
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const roadmaps = useQuery({ ...roadmapsQueryOptions, enabled: activeRoadmapId !== null });

  if (!activeRoadmapId) return null;

  const roadmap = roadmaps.data?.find((roadmap) => roadmap.id === activeRoadmapId);
  return (
    <section aria-label={t.home.currentRoadmap} className="flex flex-col gap-3">
      <QueryState query={roadmaps} loading={t.roadmaps.loading} error={t.roadmaps.loadFailed} className="text-xs">
        {roadmap && <ActiveRoadmap roadmap={roadmap} isHero={isQueueEmpty} onOpen={() => onOpen(roadmap.id)} />}
      </QueryState>
    </section>
  );
}

function ActiveRoadmap({ roadmap, isHero, onOpen }: { roadmap: Roadmap; isHero: boolean; onOpen: () => void }) {
  const t = useI18n();
  const { data: document } = useSuspenseQuery(learningDocumentQueryOptions);
  const { data: settings } = useSettingsQuery();
  const domain = settings.preferredLeetcodeSite;
  const metadata = useQuery(roadmapMetadataQueryOptions(roadmap, domain));
  const skip = useSkipRoadmapProblemMutation();
  const summary = summarizeRoadmap(document, roadmapProblemIds(roadmap), document.roadmapSkips[roadmap.id]);
  const nextId = getNextRoadmapProblemId(roadmap, document, metadata.data, domain);
  const next = nextId ? metadata.data?.[nextId] : undefined;
  const { message, onSaved } = useProblemSaveFeedback();

  return (
    <>
      <div>
        <button
          type="button"
          className={`w-full flex items-center gap-2 rounded-md text-left hover:text-accent ${buttonInteraction}`}
          onClick={onOpen}
        >
          <LuRoute aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
          <span className="min-w-0 truncate text-[13px] font-medium">{roadmap.name}</span>
          <span className="ml-auto shrink-0 text-xs text-tertiary tabular-nums">
            {t.home.roadmapReviewed(summary.reviewed, summary.total)}
          </span>
          <LuChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" />
        </button>
        <RoadmapProgress label={roadmap.name} summary={summary} className="mt-2" />
      </div>
      <QueryState query={metadata} loading={t.roadmaps.loading} error={t.roadmaps.detailLoadFailed} className="text-xs">
        {next ? (
          <div
            className={`rounded-xl border border-current ${isHero ? 'bg-surface shadow-card p-4' : 'p-3 flex items-center gap-3'}`}
          >
            <div className="min-w-0 flex-1">
              {isHero && <p className="mb-1 text-[11px] text-tertiary">{t.home.nextProblem}</p>}
              <a
                className={`flex items-start gap-1 rounded-sm hover:text-accent ${buttonInteraction} ${
                  isHero ? 'text-[17px] leading-[22px] font-semibold tracking-[-0.01em]' : 'text-[13px] font-medium'
                }`}
                href={getLeetcodeProblemUrl({ domain, slug: next.slug })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${next.frontendId}. ${getProblemTitle(next, domain)}`}
              >
                <span className="min-w-0 break-words">
                  <span className="font-normal text-tertiary tabular-nums">{next.frontendId}.</span>{' '}
                  {getProblemTitle(next, domain)}
                </span>
                {next.isPaidOnly && (
                  <LuLock
                    className={`shrink-0 text-tertiary ${isHero ? 'size-3.5 mt-1' : 'size-3 mt-[3px]'}`}
                    role="img"
                    aria-label={t.roadmaps.paidOnly}
                  />
                )}
                <LuArrowUpRight
                  aria-hidden="true"
                  className={`shrink-0 text-tertiary ${isHero ? 'size-3.5 mt-1' : 'size-3 mt-[3px]'}`}
                  strokeWidth={2}
                />
              </a>
              <div className={isHero ? 'mt-1.5' : 'mt-1'}>
                <Difficulty difficulty={next.difficulty} />
              </div>
            </div>
            <div className={isHero ? 'mt-4 flex gap-2' : 'flex shrink-0 items-center'}>
              <SaveProblemButton
                frontendId={next.frontendId}
                domain={domain}
                title={getProblemTitle(next, domain)}
                isSaved={false}
                variant={isHero ? 'primary' : 'card'}
                isDisabled={skip.isPending}
                onSaved={onSaved}
              />
              <button
                type="button"
                className={`shrink-0 flex items-center justify-center gap-1.5 text-secondary duration-[120ms] hover:bg-secondary ${buttonInteraction} ${
                  isHero ? 'h-9 px-3 rounded-lg border border-strong text-[13px]' : 'size-8 rounded-md'
                }`}
                disabled={skip.isPending}
                aria-label={t.roadmaps.skipProblem(getProblemTitle(next, domain))}
                title={isHero ? undefined : t.roadmaps.skip}
                onClick={() => skip.mutate({ roadmapId: roadmap.id, frontendId: next.frontendId, skipped: true })}
              >
                <LuSkipForward aria-hidden="true" className="size-3.5" />
                {isHero && t.roadmaps.skip}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-secondary">{t.home.noNextProblem(domain)}</p>
        )}
      </QueryState>
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
