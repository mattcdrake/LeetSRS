import { useEffect, useState } from 'react';
import './App.css';
import { useSettingsQuery } from '@/hooks/queries/settings';
import { BottomNav, type ViewId } from './components/BottomNav';
import { CardView } from './views/card/CardView';
import { HomeView } from './views/home/HomeView';
import { SettingsView } from './views/settings/SettingsView';
import { StatsView } from './views/stats/StatsView';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const { data: settings } = useSettingsQuery();

  useEffect(() => {
    if (!settings.animationsEnabled) {
      document.documentElement.classList.add('animations-disabled');
    } else {
      document.documentElement.classList.remove('animations-disabled');
    }
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);

    body.classList.remove('light', 'dark');
    body.classList.add(settings.theme);
  }, [settings]);

  const views: Record<ViewId, React.ReactNode> = {
    home: <HomeView />,
    card: <CardView />,
    stats: <StatsView />,
    settings: <SettingsView />,
  };

  return (
    <div className="flex flex-col h-full relative bg-primary text-primary">
      <div className="flex-1 overflow-hidden pb-[60px]">{views[activeView]}</div>
      <BottomNav activeView={activeView} onNavigate={setActiveView} />
    </div>
  );
}

export default App;
