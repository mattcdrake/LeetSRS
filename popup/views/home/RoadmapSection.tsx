import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { FaArrowRight, FaArrowUpRightFromSquare, FaLock } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { learningDocumentQueryOptions } from '@/popup/queries/learning-document';
import {
  activeRoadmapQueryOptions,
  roadmapMetadataQueryOptions,
  roadmapSkipsQueryOptions,
  roadmapsQueryOptions,
} from '@/popup/queries/roadmaps';
import { useSettingsQuery } from '@/popup/queries/settings';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import type { Roadmap, RoadmapId } from '@/shared/roadmap';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';
import { getProblemTitle } from '@/shared/ui/problem-title';
import '../roadmaps/roadmaps.css';

export function RoadmapSection({ onOpen }: { onOpen: (id: RoadmapId) => void }) {
  const t = useI18n();
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const roadmaps = useQuery({ ...roadmapsQueryOptions, enabled: activeRoadmapId !== null });

  if (!activeRoadmapId) return null;

  const roadmap = roadmaps.data?.find((roadmap) => roadmap.id === activeRoadmapId);
  return (
    <section aria-label={t.home.currentRoadmap} className="mt-4 pt-4 border-t border-current flex flex-col gap-2">
      <h2 className="text-xs font-medium text-secondary">{t.home.currentRoadmap}</h2>
      {roadmaps.isPending ? (
        <p role="status" className="text-sm text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : roadmaps.isError ? (
        <div role="alert" className="text-sm">
          <p>{t.roadmaps.loadFailed}</p>
          <button type="button" className="roadmap-text-button" onClick={() => void roadmaps.refetch()}>
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
  const skips = useQuery(roadmapSkipsQueryOptions);
  const ids = roadmap.groups.flatMap((group) => group.frontendIds);
  const reviewed = ids.filter((id) => document.cards[id]?.fsrs.reps > 0).length;
  const progressLabel = t.roadmaps.reviewed(reviewed, ids.length);
  const skippedIds = new Set(skips.data?.[roadmap.id]);
  const nextId = ids.find(
    (id) => !document.cards[id] && !skippedIds.has(id) && metadata.data?.[id]?.sources.includes(domain)
  );
  const next = nextId ? metadata.data?.[nextId] : undefined;

  return (
    <>
      <button type="button" className="roadmap-open" aria-label={t.roadmaps.open(roadmap.name)} onClick={onOpen}>
        <span className="roadmap-name">{roadmap.name}</span>
        <FaArrowRight aria-hidden="true" className="text-xs text-secondary" />
      </button>
      <p className="text-xs text-secondary">{progressLabel}</p>
      <progress className="roadmap-progress" value={reviewed} max={ids.length} aria-label={progressLabel} />
      {metadata.isPending || skips.isPending ? (
        <p role="status" className="text-sm text-secondary">
          {t.roadmaps.loading}
        </p>
      ) : metadata.isError || skips.isError ? (
        <div role="alert" className="text-sm">
          <p>{t.roadmaps.detailLoadFailed}</p>
          <button
            type="button"
            className="roadmap-text-button"
            onClick={() => {
              void metadata.refetch();
              void skips.refetch();
            }}
          >
            {t.roadmaps.retry}
          </button>
        </div>
      ) : next ? (
        <div className="mt-1 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary">{t.home.nextProblem}</span>
            <span className="capitalize" style={{ color: DIFFICULTY_COLORS[next.difficulty] }}>
              {next.difficulty}
            </span>
          </div>
          <div className="flex items-start gap-1">
            <a
              className="text-sm hover:text-accent break-words"
              href={getLeetcodeProblemUrl({ domain, slug: next.slug })}
              target="_blank"
              rel="noopener noreferrer"
            >
              {next.frontendId}. {getProblemTitle(next, domain)}
              <FaArrowUpRightFromSquare aria-hidden="true" className="inline ml-1.5 text-xs text-secondary" />
            </a>
            {next.isPaidOnly && (
              <FaLock className="shrink-0 mt-1 text-secondary text-xs" role="img" aria-label={t.roadmaps.paidOnly} />
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-secondary">{t.home.noNextProblem(domain)}</p>
      )}
    </>
  );
}
