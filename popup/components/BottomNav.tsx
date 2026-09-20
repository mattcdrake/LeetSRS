import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { FaCalendarDays, FaGear, FaHouseChimney, FaLayerGroup } from 'react-icons/fa6';
import { LuRoute } from 'react-icons/lu';
import { useReviewQueueQuery } from '@/popup/queries/cards';
import { useI18n } from '../contexts/I18nContext';

export type ViewId = 'home' | 'calendar' | 'roadmaps' | 'card' | 'settings';

interface BottomNavProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const t = useI18n();
  const { data: dueCards = [] } = useReviewQueueQuery();
  const dueCount = dueCards.length;

  const navItems: Array<{ id: ViewId; label: string; Icon: typeof FaHouseChimney }> = [
    { id: 'home', label: t.nav.home, Icon: FaHouseChimney },
    { id: 'roadmaps', label: t.nav.roadmaps, Icon: LuRoute },
    { id: 'calendar', label: t.nav.calendar, Icon: FaCalendarDays },
    { id: 'card', label: t.nav.cards, Icon: FaLayerGroup },
    { id: 'settings', label: t.nav.settings, Icon: FaGear },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 border-t flex justify-around items-center z-[1000] bg-secondary border-current">
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[activeView]}
        onSelectionChange={(keys) => {
          const selectedView = [...keys][0];
          if (selectedView) onNavigate(selectedView as ViewId);
        }}
        className="flex justify-around items-center w-full h-full"
      >
        {navItems.map((item) => (
          <ToggleButton
            key={item.id}
            id={item.id}
            onPress={() => {
              if (item.id === 'roadmaps') onNavigate(item.id);
            }}
            onFocus={() => {
              if (item.id !== activeView) onNavigate(item.id);
            }}
            className={({ isSelected }) =>
              `flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer p-2 transition-colors duration-200 hover:text-primary ${
                isSelected ? 'text-accent' : 'text-secondary'
              }`
            }
            aria-label={item.label}
          >
            <div className="relative">
              <item.Icon className="text-lg" />
              {item.id === 'home' && dueCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] min-w-[14px] h-3.5 rounded-full flex items-center justify-center px-0.5">
                  {dueCount > 99 ? '99+' : dueCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">{item.label}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </nav>
  );
}
