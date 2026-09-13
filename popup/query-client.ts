import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

export function createPopupQueryClient(config: QueryClientConfig = {}) {
  const { defaultOptions, ...options } = config;

  return new QueryClient({
    ...options,
    defaultOptions: {
      ...defaultOptions,
      queries: {
        networkMode: 'always',
        ...defaultOptions?.queries,
      },
      mutations: {
        networkMode: 'always',
        ...defaultOptions?.mutations,
      },
    },
  });
}
