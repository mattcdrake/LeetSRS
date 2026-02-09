import { useI18n } from '../contexts/I18nContext';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const t = useI18n();
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-current">
      <h1 className="text-xl font-bold text-primary font-jetbrains-mono">
        {title === t.app.name ? (
          <>
            {t.app.namePart1}
            <span className="text-rating-easy">{t.app.namePart2}</span>
          </>
        ) : (
          title
        )}
      </h1>
      {children}
    </div>
  );
}
