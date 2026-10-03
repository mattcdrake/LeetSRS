import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

// Popup queries read extension storage, which works offline.
export function createPopupQueryClient({ defaultOptions = {} }: Pick<QueryClientConfig, 'defaultOptions'> = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', ...defaultOptions.queries },
      mutations: { networkMode: 'always', ...defaultOptions.mutations },
    },
  });
}
