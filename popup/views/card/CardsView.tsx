import { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';
import { useCardsQuery } from '@/popup/queries/cards';
import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { filterAndSortCards } from './card-list';
import { CardListItem } from './components/CardListItem';

export function CardsView() {
  const t = useI18n();
  const { data: cards = [], isLoading } = useCardsQuery();
  const [filterText, setFilterText] = useState('');

  const sortedCards = filterAndSortCards(cards, filterText);

  return (
    <ViewLayout title={t.cardsView.title} headerContent={<StreakCounter />}>
      <div className="flex flex-col gap-4">
        {!isLoading && cards.length > 0 && (
          <TextField className="relative" value={filterText} onChange={setFilterText}>
            <Label className="sr-only">{t.cardsView.filterAriaLabel}</Label>
            <div className="relative">
              <FaMagnifyingGlass
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm"
              />
              <Input
                className="w-full pl-9 pr-9 min-h-10 py-2 bg-primary rounded-lg border border-current text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t.cardsView.filterPlaceholder}
              />
              {filterText && (
                <Button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-tertiary transition-colors"
                  onPress={() => setFilterText('')}
                  aria-label={t.cardsView.clearFilterAriaLabel}
                >
                  <FaXmark aria-hidden="true" className="text-secondary text-sm" />
                </Button>
              )}
            </div>
          </TextField>
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
