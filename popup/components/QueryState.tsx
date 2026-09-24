import type { ReactNode } from 'react';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction } from '@/popup/styles';

interface QueryStatus {
  isPending: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

interface QueryStateProps {
  query: QueryStatus | readonly QueryStatus[];
  loading: ReactNode;
  error: ReactNode;
  className?: string;
  children?: ReactNode;
}

// Renders children once every query has loaded; otherwise a loading message or an error with Retry.
export function QueryState({ query, loading, error, className, children }: QueryStateProps) {
  const t = useI18n();
  const queries = Array.isArray(query) ? query : [query as QueryStatus];

  if (queries.some((query) => query.isPending)) {
    return (
      <p role="status" className={`text-secondary ${className ?? ''}`}>
        {loading}
      </p>
    );
  }
  if (queries.some((query) => query.isError)) {
    return (
      <div role="alert" className={className}>
        <p>{error}</p>
        <button
          type="button"
          className={`text-accent ${buttonInteraction}`}
          onClick={() => {
            for (const query of queries) void query.refetch();
          }}
        >
          {t.roadmaps.retry}
        </button>
      </div>
    );
  }
  return children;
}
