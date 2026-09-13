import { useIsMutating } from '@tanstack/react-query';
import { FaArrowsRotate } from 'react-icons/fa6';
import { useI18n } from '../contexts/I18nContext';
import { gistSyncQueryKeys } from '../queries/gist-sync';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const t = useI18n();
  const syncing = useIsMutating({ mutationKey: gistSyncQueryKeys.arrival }) > 0;
  return (
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
        <span className="w-4 h-4">
          {syncing && (
            <FaArrowsRotate role="status" aria-label={t.settings.gistSync.syncing} className="animate-spin w-4 h-4" />
          )}
        </span>
      </div>
      {children}
    </div>
  );
}
