import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { LuCalendar, LuHouse, LuLayers, LuRoute, LuSettings } from 'react-icons/lu';
import { useReviewQueueQuery } from '@/popup/queries/cards';
import { useI18n } from '../contexts/I18nContext';
import { Tooltip } from './Tooltip';

export type ViewId = 'home' | 'calendar' | 'roadmaps' | 'card' | 'settings';

interface BottomNavProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const t = useI18n();
  const { data: dueCards = [] } = useReviewQueueQuery();
  const dueCount = dueCards.length;

  const navItems: Array<{ id: ViewId; label: string; Icon: typeof LuHouse }> = [
    { id: 'home', label: t.nav.home, Icon: LuHouse },
    { id: 'roadmaps', label: t.nav.roadmaps, Icon: LuRoute },
    { id: 'calendar', label: t.nav.calendar, Icon: LuCalendar },
    { id: 'card', label: t.nav.cards, Icon: LuLayers },
    { id: 'settings', label: t.nav.settings, Icon: LuSettings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-11 border-t z-[1000] bg-primary border-current">
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[activeView]}
        onSelectionChange={(keys) => {
          const selectedView = [...keys][0];
          if (selectedView) onNavigate(selectedView as ViewId);
        }}
        className="flex justify-between items-center w-full h-full px-2.5"
      >
        {navItems.map((item) => {
          const isActive = item.id === activeView;
          return (
            // Disable rather than remove the active tab's tooltip so activation does not remount the button and drop focus.
            <Tooltip key={item.id} label={item.label} isDisabled={isActive}>
              <ToggleButton
                id={item.id}
                onPress={() => {
                  if (item.id === 'roadmaps') onNavigate(item.id);
                }}
                onFocus={() => {
                  if (item.id !== activeView) onNavigate(item.id);
                }}
                className={`flex items-center h-8 rounded-md cursor-pointer transition-colors duration-[120ms] outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-[var(--current-accent)] ${
                  isActive
                    ? 'gap-1.5 px-2.5 bg-secondary text-primary text-xs font-medium'
                    : 'w-10 justify-center text-tertiary hover:text-primary hover:bg-secondary'
                }`}
                aria-label={item.label}
              >
                <item.Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                {isActive && <span className="whitespace-nowrap">{item.label}</span>}
                {isActive && item.id === 'home' && dueCount > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded bg-accent-soft text-accent text-[11px] font-semibold grid place-items-center tabular-nums">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </ToggleButton>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>
    </nav>
  );
}
