import { useEffect, useState } from 'react';
import { useArrivalRefresh } from '@/ui/useArrivalRefresh';
import './App.css';
import { useTheme } from '@/entrypoints/popup/hooks/useTheme';
import { BottomNav, type ViewId } from './components/BottomNav';
import { useI18n } from './contexts/I18nContext';
import { CardView } from './views/card/CardView';
import { HomeView } from './views/home/HomeView';
import { SettingsView } from './views/settings/SettingsView';
import { StatsView } from './views/stats/StatsView';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const theme = useTheme();
  const refresh = useArrivalRefresh();
  const t = useI18n();

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
      {(refresh.pending || refresh.notice) && (
        <p role="status" className="px-4 py-2 text-sm">
          {refresh.pending ? t.settings.gistSync.syncing : refresh.notice}
        </p>
      )}
      <fieldset
        disabled={refresh.pending}
        className="flex-1 min-h-0 min-w-0 border-0 m-0 p-0 overflow-hidden pb-[60px]"
      >
        {views[activeView]}
      </fieldset>
      <BottomNav activeView={activeView} onNavigate={setActiveView} />
    </div>
  );
}

export default App;
