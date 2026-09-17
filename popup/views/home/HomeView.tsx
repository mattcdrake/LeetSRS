import { useSuspenseQuery } from '@tanstack/react-query';
import { useI18n } from '@/popup/contexts/I18nContext';
import { activeRoadmapQueryOptions } from '@/popup/queries/roadmaps';
import { buttonInteraction } from '@/popup/styles';
import type { RoadmapId } from '@/shared/roadmap';
import { LeetcodeCnBanner } from '../../components/LeetcodeCnBanner';
import { ViewLayout } from '../../components/ViewLayout';
import { ReviewQueue } from './ReviewQueue';
import { RoadmapSection } from './RoadmapSection';
import { StatsBar } from './StatsBar';

export function HomeView({ onOpenRoadmap }: { onOpenRoadmap: (id: RoadmapId | null) => void }) {
  const t = useI18n();
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  return (
    <ViewLayout headerContent={<StatsBar />}>
      <LeetcodeCnBanner />
      <ReviewQueue
        emptyContent={
          activeRoadmapId === null && (
            <p className="mt-6 pt-4 border-t border-current text-base text-secondary text-center">
              {t.home.activateRoadmapSuggestion.before}
              <button
                type="button"
                className={`text-accent underline ${buttonInteraction}`}
                onClick={() => onOpenRoadmap(null)}
              >
                {t.home.activateRoadmapSuggestion.link}
              </button>
              {t.home.activateRoadmapSuggestion.after}
            </p>
          )
        }
      />
      <RoadmapSection onOpen={onOpenRoadmap} />
    </ViewLayout>
  );
}
