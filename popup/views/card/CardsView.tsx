import { useState } from 'react';
import { SearchFilterBar } from '@/popup/components/SearchFilterBar';
import { usePopupClock } from '@/popup/hooks/usePopupClock';
import { useCardsQuery } from '@/popup/queries/cards';
import type { CardFilter } from '@/shared/card-filters';
import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { filterAndSortCards } from './card-list';
import { CardListItem } from './components/CardListItem';

export function CardsView() {
  const t = useI18n();
  const { data: cards = [], isLoading } = useCardsQuery();
  const [filterText, setFilterText] = useState('');
  const [filters, setFilters] = useState<CardFilter[]>([]);
  const now = usePopupClock();

  const sortedCards = filterAndSortCards(cards, filterText, filters, now);

  return (
    <ViewLayout title={t.cardsView.title}>
      <div className="flex flex-col gap-4">
        {!isLoading && cards.length > 0 && (
          <SearchFilterBar
            searchText={filterText}
            onSearchTextChange={setFilterText}
            searchLabel={t.cardsView.filterAriaLabel}
            searchPlaceholder={t.cardsView.filterPlaceholder}
            clearSearchLabel={t.cardsView.clearFilterAriaLabel}
            filters={(['due', 'new', 'paused'] as const).map((filter) => ({
              id: filter,
              label: t.cardsView.filters[filter],
              isSelected: filters.includes(filter),
              onChange: (selected) =>
                setFilters((current) =>
                  selected ? [...current, filter] : current.filter((value) => value !== filter)
                ),
            }))}
          />
        )}

        {isLoading ? (
          <p className="text-secondary">{t.cardsView.loadingCards}</p>
        ) : cards.length === 0 ? (
          <p className="text-secondary">{t.cardsView.noCardsAdded}</p>
        ) : sortedCards.length === 0 ? (
          <p className="text-secondary">{t.cardsView.noCardsMatchFilter}</p>
        ) : (
          <div className="divide-y divide-[var(--current-border)]">
            {sortedCards.map((card) => (
              <CardListItem key={card.frontendId} card={card} />
            ))}
          </div>
        )}
      </div>
    </ViewLayout>
  );
}
