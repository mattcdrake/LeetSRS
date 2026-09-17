import type { RoadmapId } from '@/shared/roadmap';
import { LeetcodeCnBanner } from '../../components/LeetcodeCnBanner';
import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { ReviewQueue } from './ReviewQueue';
import { RoadmapSection } from './RoadmapSection';
import { StatsBar } from './StatsBar';

export function HomeView({ onOpenRoadmap }: { onOpenRoadmap: (id: RoadmapId) => void }) {
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
      <ReviewQueue />
      <RoadmapSection onOpen={onOpenRoadmap} />
    </ViewLayout>
  );
}
