import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// TanStack Query is the SPA's server-state layer (caching, mutations, invalidation).
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
