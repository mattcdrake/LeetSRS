import { useEffect, useState } from 'react';
import './App.css';
import { useTheme } from '@/hooks/useTheme';
import { BottomNav, type ViewId } from './components/BottomNav';
import { CardView } from './views/card/CardView';
import { HomeView } from './views/home/HomeView';
import { SettingsView } from './views/settings/SettingsView';
import { StatsView } from './views/stats/StatsView';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const theme = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;

    body.classList.remove('light', 'dark');
    body.classList.add(theme);
    body.style.colorScheme = theme;
  }, [theme]);

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
