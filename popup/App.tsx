import { useEffect, useState } from 'react';
import { GithubMigrationNotice } from '@/popup/legacy/GithubMigrationNotice';
import './App.css';
import { useTheme } from '@/popup/hooks/useTheme';
import { BottomNav, type ViewId } from './components/BottomNav';
import { CardsView } from './views/card/CardsView';
import { HomeView } from './views/home/HomeView';
import { SettingsView } from './views/settings/SettingsView';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [highlightGithubSignIn, setHighlightGithubSignIn] = useState(false);
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
    card: <CardsView />,
    settings: <SettingsView highlightGithubSignIn={highlightGithubSignIn} />,
  };

  return (
    <div className="flex flex-col h-full relative bg-primary text-primary">
      {activeView !== 'settings' && (
        <GithubMigrationNotice
          onOpenSettings={() => {
            setHighlightGithubSignIn(true);
            setActiveView('settings');
          }}
        />
      )}
      <div className="flex-1 min-h-0 min-w-0 border-0 m-0 p-0 overflow-hidden pb-[60px]">{views[activeView]}</div>
      <BottomNav
        activeView={activeView}
        onNavigate={(view) => {
          setHighlightGithubSignIn(false);
          setActiveView(view);
        }}
      />
    </div>
  );
}

export default App;
