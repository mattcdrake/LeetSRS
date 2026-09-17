import { useSuspenseQuery } from '@tanstack/react-query';
import { useI18n } from '@/popup/contexts/I18nContext';
import { activeRoadmapQueryOptions } from '@/popup/queries/roadmaps';
import { buttonInteraction } from '@/popup/styles';
import type { RoadmapId } from '@/shared/roadmap';
import { LeetcodeCnBanner } from '../../components/LeetcodeCnBanner';
import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { ReviewQueue } from './ReviewQueue';
import { RoadmapSection } from './RoadmapSection';
import { StatsBar } from './StatsBar';

export function HomeView({ onOpenRoadmap }: { onOpenRoadmap: (id: RoadmapId | null) => void }) {
  const t = useI18n();
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  return (
    <ViewLayout
      headerContent={
        <div className="flex items-center justify-end gap-4 w-full">
          <StatsBar />
          <StreakCounter />
        </div>
      }
    >
      <LeetcodeCnBanner />
      <ReviewQueue
        emptyContent={
          activeRoadmapId === null && (
            <div className="text-sm text-secondary text-center flex flex-col items-center gap-2 pt-2">
              <p>{t.home.activateRoadmapSuggestion}</p>
              <button type="button" className={`text-accent ${buttonInteraction}`} onClick={() => onOpenRoadmap(null)}>
                {t.home.browseRoadmaps}
              </button>
            </div>
          )
        }
      />
      <RoadmapSection onOpen={onOpenRoadmap} />
    </ViewLayout>
  );
}
