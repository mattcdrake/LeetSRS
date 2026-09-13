import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode, Suspense } from 'react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './contexts/I18nContext';
import { useStorageQueryEvents } from './queries/storage-events';

function PopupStorageObserver() {
  useStorageQueryEvents();
  return null;
}

export function PopupRoot({ queryClient }: { queryClient: QueryClient }) {
  return (
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <PopupStorageObserver />
          <Suspense
            fallback={
              <div className="popup-loading" role="status" aria-label="Loading">
                <div className="popup-loading-spinner" />
              </div>
            }
          >
            <I18nProvider>
              <App />
            </I18nProvider>
          </Suspense>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
