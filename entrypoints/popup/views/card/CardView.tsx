import { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';
import { useCardsQuery } from '@/hooks/queries/cards';
import { StreakCounter } from '../../components/StreakCounter';
import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { filterAndSortCards } from './card-list';
import { CardListItem } from './components/CardListItem';

export function CardView() {
  const t = useI18n();
  const { data: cards = [], isLoading } = useCardsQuery();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  const sortedCards = filterAndSortCards(cards, filterText);

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const removeExpandedCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      newSet.delete(cardId);
      return newSet;
    });
  };

  return (
    <ViewLayout title={t.cardsView.title} headerContent={<StreakCounter />}>
      <div className="flex flex-col gap-4">
        {!isLoading && cards.length > 0 && (
          <TextField className="relative" value={filterText} onChange={setFilterText}>
            <Label className="sr-only">{t.cardsView.filterAriaLabel}</Label>
            <div className="relative">
              <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm" />
              <Input
                className="w-full pl-9 pr-9 py-2 bg-secondary rounded-lg border border-current text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder={t.cardsView.filterPlaceholder}
              />
              {filterText && (
                <Button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-tertiary transition-colors"
                  onPress={() => setFilterText('')}
                  aria-label={t.cardsView.clearFilterAriaLabel}
                >
                  <FaXmark className="text-secondary text-sm" />
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
          <div className="space-y-2">
            {sortedCards.map((card) => (
              <CardListItem
                key={card.id}
                card={card}
                isExpanded={expandedCards.has(card.id)}
                onToggle={() => toggleCard(card.id)}
                onDeleted={() => removeExpandedCard(card.id)}
              />
            ))}
          </div>
        )}
      </div>
    </ViewLayout>
  );
}
