import { createContext, useContext } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { StreakCounter } from './StreakCounter';

export const ViewBannerContext = createContext<React.ReactNode>(null);

interface ViewLayoutProps {
  title?: string;
  headerLeading?: React.ReactNode;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}

export function ViewLayout({ title = 'LeetSRS', headerLeading, headerContent, children }: ViewLayoutProps) {
  const t = useI18n();
  const banner = useContext(ViewBannerContext);
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2 h-11 px-4 bg-primary border-b border-current">
          <div className="flex items-center gap-2 min-w-0">
            {headerLeading}
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-primary font-jetbrains-mono">
              {title === t.app.name ? (
                <>
                  {t.app.namePart1}
                  <span className="text-brand">{t.app.namePart2}</span>
                </>
              ) : (
                title
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {headerContent}
            <StreakCounter />
          </div>
        </div>
        {banner}
      </header>

      <main
        className="flex-1 flex flex-col py-4 gap-4 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <div className="px-4">{children}</div>
      </main>
    </div>
  );
}
