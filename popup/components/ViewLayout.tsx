import { useI18n } from '../contexts/I18nContext';

interface ViewLayoutProps {
  title?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}

export function ViewLayout({ title = 'LeetSRS', headerContent, children }: ViewLayoutProps) {
  const t = useI18n();
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-current">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-xl font-bold text-primary font-jetbrains-mono">
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
          {headerContent}
        </div>
      </div>

      <div
        className="flex-1 flex flex-col py-4 gap-4 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="px-4">{children}</div>
      </div>
    </div>
  );
}
