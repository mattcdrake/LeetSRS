import { useSuspenseQuery } from '@tanstack/react-query';
import { LuRoute } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useReviewQueueQuery } from '@/popup/queries/cards';
import { activeRoadmapQueryOptions } from '@/popup/queries/roadmaps';
import { buttonInteraction } from '@/popup/styles';
import type { RoadmapId } from '@/shared/roadmap';
import { LeetSRSLogo } from '@/shared/ui/LeetSRSLogo';
import { LeetcodeCnBanner } from '../../components/LeetcodeCnBanner';
import { ViewLayout } from '../../components/ViewLayout';
import { ReviewQueue } from './ReviewQueue';
import { RoadmapSection } from './RoadmapSection';
import { StatsBar } from './StatsBar';

function AddProblemsHint({ className = '' }: { className?: string }) {
  const t = useI18n();
  return (
    <p className={`text-xs leading-[18px] text-tertiary ${className}`}>
      {t.home.addProblemsInstructions}{' '}
      <span className="inline-grid place-items-center align-[-4px] size-[18px] rounded bg-secondary text-accent">
        <LeetSRSLogo width="12" height="12" />
      </span>{' '}
      {t.home.addProblemsButton}
    </p>
  );
}

function FreshStart({ onChooseRoadmap }: { onChooseRoadmap: () => void }) {
  const t = useI18n();
  return (
    <div className="min-h-[400px] flex flex-col justify-center px-2">
      <div className="size-11 rounded-xl bg-accent-soft text-accent grid place-items-center">
        <LeetSRSLogo width="20" height="20" />
      </div>
      <h2 className="mt-4 text-[19px] leading-6 font-semibold tracking-[-0.015em]">{t.home.freshTitle}</h2>
      <p className="mt-1.5 text-[13px] leading-5 text-secondary">{t.home.freshDescription}</p>
      <button
        type="button"
        className={`mt-5 h-10 rounded-lg bg-accent text-on-accent text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 ${buttonInteraction}`}
        onClick={onChooseRoadmap}
      >
        <LuRoute aria-hidden="true" className="size-4" />
        {t.home.chooseRoadmap}
      </button>
      <AddProblemsHint className="mt-6 pt-5 border-t border-current" />
    </div>
  );
}

export function HomeView({ onOpenRoadmap }: { onOpenRoadmap: (id: RoadmapId | null) => void }) {
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const { data: queue } = useReviewQueueQuery();
  const isQueueEmpty = queue?.length === 0;
  return (
    <ViewLayout headerContent={<StatsBar />}>
      <LeetcodeCnBanner />
      <div className="flex flex-col gap-5">
        <ReviewQueue
          emptyContent={
            activeRoadmapId === null ? <FreshStart onChooseRoadmap={() => onOpenRoadmap(null)} /> : undefined
          }
        />
        <RoadmapSection isQueueEmpty={isQueueEmpty} onOpen={onOpenRoadmap} />
        {isQueueEmpty && activeRoadmapId !== null && <AddProblemsHint className="-mt-1 px-4 text-center" />}
      </div>
    </ViewLayout>
  );
}
