import { Button, Input, Label, TextField, ToggleButton } from 'react-aria-components';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';

interface SearchFilterBarProps {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
  filters: readonly {
    id: string;
    label: string;
    isSelected: boolean;
    onChange: (selected: boolean) => void;
  }[];
}

export function SearchFilterBar({
  searchText,
  onSearchTextChange,
  searchLabel,
  searchPlaceholder,
  clearSearchLabel,
  filters,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <TextField className="relative" value={searchText} onChange={onSearchTextChange}>
        <Label className="sr-only">{searchLabel}</Label>
        <div className="relative">
          <FaMagnifyingGlass
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm"
          />
          <Input
            className="w-full pl-9 pr-9 min-h-10 py-2 bg-primary rounded-lg border border-current text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={searchPlaceholder}
          />
          {searchText && (
            <Button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-tertiary transition-colors"
              onPress={() => onSearchTextChange('')}
              aria-label={clearSearchLabel}
            >
              <FaXmark aria-hidden="true" className="text-secondary text-sm" />
            </Button>
          )}
        </div>
      </TextField>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <ToggleButton
            key={filter.id}
            isSelected={filter.isSelected}
            onChange={filter.onChange}
            className={({ isSelected }) =>
              `h-7 px-2.5 rounded-full border text-xs font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--current-accent)] ${
                isSelected
                  ? 'bg-[color-mix(in_srgb,var(--current-accent)_12%,var(--current-bg-primary))] text-primary border-[color-mix(in_srgb,var(--current-accent)_50%,var(--current-border))]'
                  : 'bg-primary text-secondary border-current hover:bg-tertiary'
              }`
            }
          >
            {filter.label}
          </ToggleButton>
        ))}
      </div>
    </div>
  );
}
