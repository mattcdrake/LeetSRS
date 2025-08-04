import { Header } from '../../components/Header';
import { StatsBar } from './StatsBar';
import { ReviewCard } from './ReviewCard';
import { NotesSection } from './NotesSection';
import { Difficulty } from '@/shared/cards';

export function HomeView() {
  const card = {
    id: '132fb1c2-3d4e-5f6g-7h8i-9j0k1l2m3n4o',
    leetcodeId: '1',
    slug: 'two-sum',
    name: 'Two Sum',
    difficulty: 'Hard' as Difficulty,
  };

  return (
    <div className="flex flex-col h-full">
      <Header>
        <StatsBar />
      </Header>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <ReviewCard card={card} />
        <NotesSection cardId={card.id} />
      </div>
    </div>
  );
}
