import { i18n } from '@/shared/i18n';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-current">
      <h1 className="text-xl font-bold text-primary font-geist-mono">
        {title === i18n.app.name ? (
          <>
            {i18n.app.namePart1}
            <span className="text-rating-easy">{i18n.app.namePart2}</span>
          </>
        ) : (
          title
        )}
      </h1>
      {children}
    </div>
  );
}
