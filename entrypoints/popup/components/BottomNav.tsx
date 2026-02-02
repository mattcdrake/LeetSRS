import { FaHouseChimney, FaChartSimple, FaGear, FaCode } from 'react-icons/fa6';
import { Tabs, TabList, Tab } from 'react-aria-components';
import { i18n } from '@/shared/i18n';
import { useReviewQueueQuery } from '@/hooks/useBackgroundQueries';

export type ViewId = 'home' | 'card' | 'stats' | 'settings';

interface BottomNavProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const { data: dueCards = [] } = useReviewQueueQuery();
  const dueCount = dueCards.length;

  const navItems: Array<{ id: ViewId; label: string; Icon: typeof FaHouseChimney }> = [
    { id: 'home', label: i18n.nav.home, Icon: FaHouseChimney },
    { id: 'card', label: i18n.nav.cards, Icon: FaCode },
    { id: 'stats', label: i18n.nav.stats, Icon: FaChartSimple },
    { id: 'settings', label: i18n.nav.settings, Icon: FaGear },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 border-t flex justify-around items-center z-[1000] bg-secondary border-current">
      <Tabs
        selectedKey={activeView}
        onSelectionChange={(key) => onNavigate(key as ViewId)}
        className="flex justify-around items-center w-full h-full"
      >
        <TabList className="flex justify-around items-center w-full h-full">
          {navItems.map((item) => (
            <Tab
              key={item.id}
              id={item.id}
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
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </nav>
  );
}
