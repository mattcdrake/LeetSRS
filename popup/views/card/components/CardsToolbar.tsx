import {
  Button,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  TextField,
  ToggleButton,
} from 'react-aria-components';
import { LuArrowUpDown, LuCheck, LuChevronDown, LuSearch, LuX } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction, menuItem, menuPopover } from '@/popup/styles';
import { CARD_FILTERS, type CardFilter } from '@/shared/card-filters';
import { CARD_SORTS, type CardSort } from '../card-list';

interface CardsToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  filters: readonly CardFilter[];
  onFiltersChange: (filters: CardFilter[]) => void;
  sort: CardSort;
  onSortChange: (sort: CardSort) => void;
  counts: Record<CardFilter, number>;
  shown: number;
  total: number;
}

// Pinned at the top of the scroll container; group headers stick at its 88px height.
export function CardsToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  counts,
  shown,
  total,
}: CardsToolbarProps) {
  const t = useI18n();
  const isFiltering = search !== '' || filters.length > 0;

  return (
    <div className="sticky top-0 z-20 bg-primary px-4 pt-3 pb-2">
      <div className="h-8 flex items-center gap-2 pl-2.5 pr-1 rounded-lg bg-secondary has-[input:focus]:ring-2 has-[input:focus]:ring-[var(--current-accent)]">
        <LuSearch aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" strokeWidth={2} />
        <TextField value={search} onChange={onSearchChange} className="min-w-0 flex-1">
          <Label className="sr-only">{t.cardsView.searchLabel}</Label>
          <Input
            className="w-full bg-transparent text-[13px] text-primary outline-none placeholder:text-tertiary"
            placeholder={t.cardsView.searchPlaceholder}
          />
        </TextField>
        {search && (
          <Button
            aria-label={t.cardsView.clearSearch}
            onPress={() => onSearchChange('')}
            className={`size-6 shrink-0 grid place-items-center rounded text-tertiary duration-[120ms] hover:bg-tertiary hover:text-primary ${buttonInteraction}`}
          >
            <LuX aria-hidden="true" className="size-3.5" />
          </Button>
        )}
        <MenuTrigger>
          <Button
            aria-label={t.cardsView.sortLabel(t.cardsView.sorts[sort])}
            className={`h-6 px-1.5 shrink-0 rounded-md flex items-center gap-1 text-xs text-secondary whitespace-nowrap duration-[120ms] hover:bg-tertiary data-[pressed]:bg-tertiary ${buttonInteraction}`}
          >
            <LuArrowUpDown aria-hidden="true" className="size-3.5" strokeWidth={2} />
            {t.cardsView.sorts[sort]}
            <LuChevronDown aria-hidden="true" className="size-3" strokeWidth={2} />
          </Button>
          <Popover placement="bottom end" offset={6} className={`${menuPopover} w-40`}>
            <Menu
              className="outline-none"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[sort]}
              onSelectionChange={(keys) => {
                const [key] = keys === 'all' ? [] : [...keys];
                if (key !== undefined) onSortChange(key as CardSort);
              }}
            >
              {CARD_SORTS.map((id) => (
                <MenuItem key={id} id={id} textValue={t.cardsView.sorts[id]} className={menuItem}>
                  {({ isSelected }) => (
                    <>
                      <span className="w-3.5 shrink-0 text-accent">
                        {isSelected && <LuCheck aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
                      </span>
                      {t.cardsView.sorts[id]}
                    </>
                  )}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {CARD_FILTERS.map((filter) => (
          <ToggleButton
            key={filter}
            isSelected={filters.includes(filter)}
            onChange={(selected) =>
              onFiltersChange(selected ? [...filters, filter] : filters.filter((value) => value !== filter))
            }
            className={({ isSelected }) =>
              `h-7 px-2.5 shrink-0 rounded-md flex items-center gap-1.5 text-xs font-medium whitespace-nowrap duration-[120ms] ${buttonInteraction} ${
                isSelected ? 'bg-accent-soft text-accent' : 'border border-current text-secondary hover:bg-secondary'
              }`
            }
          >
            {({ isSelected }) => (
              <>
                {isSelected && <LuCheck aria-hidden="true" className="size-3" strokeWidth={2.4} />}
                {t.cardsView.filters[filter]}
                <span className={`font-normal tabular-nums ${isSelected ? 'opacity-80' : 'text-tertiary'}`}>
                  {counts[filter]}
                </span>
              </>
            )}
          </ToggleButton>
        ))}
        <p aria-live="polite" className="ml-auto min-w-0 truncate text-xs text-tertiary tabular-nums">
          {isFiltering ? t.cardsView.filteredCount(shown, total) : t.cardsView.count(total)}
        </p>
      </div>
    </div>
  );
}
