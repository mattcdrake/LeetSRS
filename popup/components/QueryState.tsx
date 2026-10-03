import type { ReactNode } from 'react';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction } from '@/popup/styles';

interface QueryStateProps {
  query: { isPending: boolean; isError: boolean; refetch: () => Promise<unknown> };
  loading: ReactNode;
  error: ReactNode;
  className?: string;
  children?: ReactNode;
}

// Renders children once the query has loaded; otherwise a loading message or an error with Retry.
export function QueryState({ query, loading, error, className, children }: QueryStateProps) {
  const t = useI18n();

  if (query.isPending) {
    return (
      <p role="status" className={`text-secondary ${className ?? ''}`}>
        {loading}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className={className}>
        <p>{error}</p>
        <button type="button" className={`text-accent ${buttonInteraction}`} onClick={() => void query.refetch()}>
          {t.roadmaps.retry}
        </button>
      </div>
    );
  }
  return children;
}
