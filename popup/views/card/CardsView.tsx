import { useState } from 'react';
import { LuLayers, LuRoute } from 'react-icons/lu';
import { EmptyState } from '@/popup/components/EmptyState';
import { NoMatches } from '@/popup/components/NoMatches';
import { usePopupClock } from '@/popup/hooks/usePopupClock';
import { type CardWithProblem, useCardsQuery } from '@/popup/queries/cards';
import { compactOutlineButton } from '@/popup/styles';
import type { CardFilter } from '@/shared/card-filters';
import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { type CardGroup, type CardSort, countCardFilters, filterAndSortCards, groupCardsByDue } from './card-list';
import { CardListItem } from './components/CardListItem';
import { CardsToolbar } from './components/CardsToolbar';
import './cards.css';

interface CardsViewProps {
  onBrowseRoadmaps: () => void;
}

export function CardsView({ onBrowseRoadmaps }: CardsViewProps) {
  const t = useI18n();
  const { data: cards = [], isLoading } = useCardsQuery();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CardFilter[]>([]);
  const [sort, setSort] = useState<CardSort>('due');
  const now = usePopupClock();

  const sortedCards = filterAndSortCards(cards, search, filters, now, sort);
  const renderCard = (card: CardWithProblem) => (
    <div key={card.frontendId} className="px-4">
      <CardListItem card={card} now={now} />
    </div>
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = <CardSkeleton />;
  } else if (cards.length === 0) {
    content = (
      <div className="px-4 pt-4">
        <EmptyState
          icon={<LuLayers aria-hidden="true" className="size-4" />}
          title={t.cardsView.emptyTitle}
          description={t.cardsView.emptyDescription}
        />
        <button
          type="button"
          className={`mt-3 inline-flex items-center gap-1 ${compactOutlineButton}`}
          onClick={onBrowseRoadmaps}
        >
          <LuRoute aria-hidden="true" className="size-3.5" />
          {t.cardsView.browseRoadmaps}
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <CardsToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          counts={countCardFilters(cards, now)}
          shown={sortedCards.length}
          total={cards.length}
        />
        {sortedCards.length === 0 ? (
          <NoMatches
            title={t.cardsView.noMatches}
            hint={t.cardsView.noMatchesHint}
            clearLabel={t.cardsView.clearFilters}
            onClear={() => {
              setSearch('');
              setFilters([]);
            }}
          />
        ) : (
          // Headers and rows share one keyed list, so a card that changes group keeps its state.
          // Each header pins below the toolbar and covers the one before it.
          <div className="pb-4">
            {sort === 'due'
              ? groupCardsByDue(sortedCards, now).flatMap((group) => [
                  <GroupHeader key={`group-${group.id}`} group={group} />,
                  ...group.cards.map(renderCard),
                ])
              : sortedCards.map(renderCard)}
          </div>
        )}
      </>
    );
  }

  return (
    <ViewLayout title={t.cardsView.title} flush>
      {content}
    </ViewLayout>
  );
}

function GroupHeader({ group }: { group: CardGroup }) {
  const t = useI18n();
  return (
    <h2 className="card-group-header sticky top-[88px] z-10 bg-primary">
      <span className="flex items-center justify-between px-4 pt-2.5 pb-1 border-b border-transparent text-[11px] leading-4 font-medium text-tertiary">
        <span className={group.id === 'overdue' ? 'text-[var(--warning-text)]' : ''}>
          {t.cardsView.groups[group.id]}
        </span>
        <span className="font-normal tabular-nums">{group.cards.length}</span>
      </span>
    </h2>
  );
}

function CardSkeleton() {
  const t = useI18n();
  return (
    <div role="status" className="px-4 pt-3">
      <span className="sr-only">{t.cardsView.loadingCards}</span>
      {[72, 58, 66, 50].map((width) => (
        <div key={width} aria-hidden="true" className="flex min-h-12 items-center gap-2 py-1.5">
          <span className="size-3.5 shrink-0 rounded bg-secondary" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-2.5 rounded bg-secondary" style={{ width: `${width}%` }} />
            <span className="h-2 w-24 rounded bg-secondary" />
          </span>
        </div>
      ))}
    </div>
  );
}
