import type { ReactNode } from 'react';
import {
  Button,
  Input,
  type Key,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
  Text,
  TextField,
} from 'react-aria-components';
import { LuCheck, LuChevronDown, LuListFilter, LuSearch, LuX } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction, menuItem } from '@/popup/styles';
import { ROADMAP_FILTERS, type RoadmapFilter } from './RoadmapProblemList';

// Menu key for "no filter"; RoadmapFilter ids never collide with it.
const ALL = 'all';

interface RoadmapToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  filter: RoadmapFilter | null;
  onFilterChange: (filter: RoadmapFilter | null) => void;
  total: number;
  counts: Record<RoadmapFilter, number>;
  children?: ReactNode;
}

// Pinned above the topic headers, which stick at its 48px height.
export function RoadmapToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  total,
  counts,
  children,
}: RoadmapToolbarProps) {
  const t = useI18n();
  const filterLabel = filter ? t.roadmaps.filters[filter] : t.roadmaps.all;

  const menu = (
    <Popover
      placement="bottom end"
      offset={6}
      className="z-[1100] w-48 rounded-xl border border-strong bg-surface p-1 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.18)]"
    >
      <Menu
        className="outline-none"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[filter ?? ALL]}
        onSelectionChange={(keys) => {
          const [key] = keys === 'all' ? [] : [...keys];
          onFilterChange(key === ALL || key === undefined ? null : (key as RoadmapFilter));
        }}
      >
        <FilterItem id={ALL} label={t.roadmaps.all} count={total} />
        <Separator className="my-1 border-t border-current" />
        {ROADMAP_FILTERS.map((id) => (
          <FilterItem key={id} id={id} label={t.roadmaps.filters[id]} count={counts[id]} />
        ))}
      </Menu>
    </Popover>
  );

  return (
    <div className="sticky top-0 z-20 bg-primary px-4 py-2">
      <div className="h-8 flex items-center gap-2 pl-2.5 pr-1 rounded-lg bg-secondary has-[input:focus]:ring-2 has-[input:focus]:ring-[var(--current-accent)]">
        <LuSearch aria-hidden="true" className="size-3.5 shrink-0 text-tertiary" strokeWidth={2} />
        <TextField
          aria-label={t.roadmaps.searchLabel}
          value={search}
          onChange={onSearchChange}
          className="min-w-0 flex-1"
        >
          <Input
            className="w-full bg-transparent text-[13px] text-primary outline-none placeholder:text-tertiary"
            placeholder={t.roadmaps.searchPlaceholder}
          />
        </TextField>
        {search && (
          <Button
            aria-label={t.roadmaps.clearSearch}
            onPress={() => onSearchChange('')}
            className={`size-6 shrink-0 grid place-items-center rounded text-tertiary duration-[120ms] hover:bg-tertiary hover:text-primary ${buttonInteraction}`}
          >
            <LuX aria-hidden="true" className="size-3.5" />
          </Button>
        )}
        {filter ? (
          <div className="h-6 shrink-0 flex items-center rounded-md bg-accent-soft text-accent text-xs font-medium">
            <MenuTrigger>
              <Button
                aria-label={t.roadmaps.filterLabel(filterLabel)}
                className={`h-full pl-2 pr-1 rounded-l-md whitespace-nowrap ${buttonInteraction}`}
              >
                {filterLabel}
              </Button>
              {menu}
            </MenuTrigger>
            <Button
              aria-label={t.roadmaps.clearFilter}
              onPress={() => onFilterChange(null)}
              className={`h-full pl-0.5 pr-1.5 rounded-r-md grid place-items-center ${buttonInteraction}`}
            >
              <LuX aria-hidden="true" className="size-3" strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <MenuTrigger>
            <Button
              aria-label={t.roadmaps.filterLabel(filterLabel)}
              className={`h-6 px-1.5 shrink-0 rounded-md flex items-center gap-1 text-xs text-secondary whitespace-nowrap duration-[120ms] hover:bg-tertiary data-[pressed]:bg-tertiary ${buttonInteraction}`}
            >
              <LuListFilter aria-hidden="true" className="size-3.5" strokeWidth={2} />
              {filterLabel}
              <LuChevronDown aria-hidden="true" className="size-3" strokeWidth={2} />
            </Button>
            {menu}
          </MenuTrigger>
        )}
      </div>
      {children}
    </div>
  );
}

function FilterItem({ id, label, count }: { id: Key; label: string; count: number }) {
  return (
    <MenuItem id={id} textValue={label} className={`${menuItem} text-[13px]`}>
      {({ isSelected }) => (
        <>
          <span className="w-3.5 shrink-0 text-accent">
            {isSelected && <LuCheck aria-hidden="true" className="size-3.5" strokeWidth={2.2} />}
          </span>
          <Text slot="label">{label}</Text>
          <Text slot="description" className="ml-auto text-xs text-tertiary tabular-nums">
            {count}
          </Text>
        </>
      )}
    </MenuItem>
  );
}
