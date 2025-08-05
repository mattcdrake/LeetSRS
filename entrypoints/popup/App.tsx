import { useState, useEffect } from 'react';
import './App.css';
import { BottomNav, type ViewId } from './components/BottomNav';
import { HomeView } from './views/home/HomeView';
import { StatsView } from './views/stats/StatsView';
import { SettingsView } from './views/settings/SettingsView';
import { DebugView } from './views/debug/DebugView';
import { useAnimationsEnabledQuery, useThemeQuery } from '@/hooks/useBackgroundQueries';
import { DEFAULT_THEME } from '@/shared/settings';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const { data: animationsEnabled = true } = useAnimationsEnabledQuery();
  const { data: theme = DEFAULT_THEME } = useThemeQuery();

  useEffect(() => {
    if (!animationsEnabled) {
      document.documentElement.classList.add('animations-disabled');
    } else {
      document.documentElement.classList.remove('animations-disabled');
    }
  }, [animationsEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    body.classList.remove('light', 'dark');
    body.classList.add(theme);
  }, [theme]);

  const views: Record<ViewId, React.ReactNode> = {
    home: <HomeView />,
    stats: <StatsView />,
    settings: <SettingsView />,
    debug: <DebugView />,
  };

  return (
    <div className="flex flex-col h-full relative bg-primary text-primary">
      <div className="flex-1 overflow-hidden pb-[60px]">{views[activeView]}</div>
      <BottomNav activeView={activeView} onNavigate={setActiveView} />
    </div>
  );
}

export default App;
