import { Header } from './Header';

interface ViewLayoutProps {
  title?: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}

export function ViewLayout({ title = 'LeetSRS', headerContent, children }: ViewLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <Header title={title}>{headerContent}</Header>
      </div>

      <div
        className="flex-1 flex flex-col py-4 gap-4 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="pr-2" style={{ paddingLeft: 'calc(0.5rem + 12px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
