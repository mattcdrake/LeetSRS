import { Header } from '../../components/Header';
import { StatsBar } from './StatsBar';
import { ReviewQueue } from './ReviewQueue';

export function HomeView() {
  return (
    <div className="flex flex-col h-full">
      <Header>
        <StatsBar />
      </Header>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto overflow-x-hidden">
        <ReviewQueue />
      </div>
    </div>
  );
}
