import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { PopupDialogHost } from '@/popup/dialogs/PopupDialogHost';
import './App.css';
import { useTheme } from '@/popup/hooks/useTheme';
import { GithubMigrationBanner } from '@/popup/legacy/GithubMigrationBanner';
import { gistSyncQueryKeys, useGistSyncConfigQuery, useGithubAuthQuery } from '@/popup/queries/gist-sync';
import { background } from '@/shared/background-service';
import type { RoadmapId } from '@/shared/roadmap';
import { BottomNav, type ViewId } from './components/BottomNav';
import { ViewBannerContext } from './components/ViewLayout';
import { activeRoadmapQueryOptions } from './queries/roadmaps';
import { CalendarView } from './views/calendar/CalendarView';
import { CardsView } from './views/card/CardsView';
import { HomeView } from './views/home/HomeView';
import { RoadmapsView } from './views/roadmaps/RoadmapsView';
import { SettingsView } from './views/settings/SettingsView';

type SettingsHighlight = 'githubSignIn' | 'gistSetup';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<RoadmapId | null>(null);
  const { data: activeRoadmapId } = useSuspenseQuery(activeRoadmapQueryOptions);
  const [highlight, setHighlight] = useState<SettingsHighlight | null>(null);
  const setupShown = useRef(false);
  const auth = useGithubAuthQuery();
  const config = useGistSyncConfigQuery();
  const client = useQueryClient();
  const { mutate: dismissSetup } = useMutation({
    mutationFn: () => background.dismissGithubSetupPrompt(),
    onSuccess: () => client.invalidateQueries({ queryKey: gistSyncQueryKeys.auth }),
  });
  const theme = useTheme();

  useEffect(() => {
    if (!auth.data?.account) {
      setupShown.current = false;
      return;
    }
    if (!auth.data.setupPending || auth.data.signingIn || !config.data || setupShown.current) return;
    setupShown.current = true;
    if (!config.data.gistId) {
      setActiveView('settings');
      setHighlight('gistSetup');
    }
    dismissSetup();
  }, [auth.data, config.data, dismissSetup]);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);

  const navigate = (
    view: ViewId,
    { highlight = null, roadmapId = null }: { highlight?: SettingsHighlight | null; roadmapId?: RoadmapId | null } = {}
  ) => {
    if (view === 'roadmaps') setSelectedRoadmapId(roadmapId);
    setHighlight(highlight);
    setActiveView(view);
  };

  const views: Record<ViewId, React.ReactNode> = {
    home: <HomeView onOpenRoadmap={(roadmapId) => navigate('roadmaps', { roadmapId })} />,
    roadmaps: <RoadmapsView selectedRoadmapId={selectedRoadmapId} onSelect={setSelectedRoadmapId} />,
    calendar: <CalendarView />,
    card: <CardsView />,
    settings: (
      <SettingsView
        highlightGithubSignIn={highlight === 'githubSignIn'}
        highlightGistSetup={highlight === 'gistSetup'}
      />
    ),
  };

  return (
    <div className="flex flex-col h-full relative bg-primary text-primary">
      <PopupDialogHost onNavigate={(view) => navigate(view)} />
      <ViewBannerContext
        value={<GithubMigrationBanner onOpenSettings={() => navigate('settings', { highlight: 'githubSignIn' })} />}
      >
        <div className="flex-1 min-h-0 min-w-0 border-0 m-0 p-0 overflow-hidden pb-[60px]">{views[activeView]}</div>
      </ViewBannerContext>
      <BottomNav activeView={activeView} onNavigate={(view) => navigate(view, { roadmapId: activeRoadmapId })} />
    </div>
  );
}

export default App;
