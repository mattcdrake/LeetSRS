import { useState } from 'react';
import './App.css';
import { BottomNav, type ViewId } from './components/BottomNav';
import { HomeView } from './views/home/HomeView';
import { StatsView } from './views/stats/StatsView';
import { SettingsView } from './views/settings/SettingsView';
import { DebugView } from './views/debug/DebugView';

function App() {
  const [activeView, setActiveView] = useState<ViewId>('home');

  const views: Record<ViewId, React.ReactNode> = {
    home: <HomeView />,
    stats: <StatsView />,
    settings: <SettingsView />,
    debug: <DebugView />,
  };

  return (
    <div className="flex flex-col h-full relative bg-primary text-primary">
      <div className="flex-1 overflow-y-auto pb-[60px]">{views[activeView]}</div>

      <BottomNav activeView={activeView} onNavigate={setActiveView} />
    </div>
  );
}

export default App;
