import ReactDOM from 'react-dom/client';
import { PopupRoot } from '../../popup/PopupRoot';
import { createPopupQueryClient } from '../../popup/query-client';

const queryClient = createPopupQueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(<PopupRoot queryClient={queryClient} />);
