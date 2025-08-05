import { FaHouseChimney, FaChartSimple, FaGear, FaBug, FaCode } from 'react-icons/fa6';
import { Tabs, TabList, Tab } from 'react-aria-components';

export type ViewId = 'home' | 'card' | 'stats' | 'settings' | 'debug';

interface BottomNavProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const navItems: Array<{ id: ViewId; label: string; Icon: typeof FaHouseChimney }> = [
    { id: 'home', label: 'Home', Icon: FaHouseChimney },
    { id: 'card', label: 'Cards', Icon: FaCode },
    { id: 'stats', label: 'Stats', Icon: FaChartSimple },
    { id: 'settings', label: 'Settings', Icon: FaGear },
    { id: 'debug', label: 'Debug', Icon: FaBug },
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
              <item.Icon className="text-lg" />
              <span className="text-[11px]">{item.label}</span>
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </nav>
  );
}
