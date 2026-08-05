import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isTransportFailure, reportReachable } from '../reachability';

// TanStack Query is the SPA's server-state layer (caching, mutations, invalidation).
//
// B-260: the cache is also where "the server is unreachable" is observed. Every query outcome
// reports to the reachability store — a transport failure (fetch rejected, or a gateway
// 502/503/504) raises the offline banner, and any success clears it. `retry: 1` means a query
// has already been given a second chance before its error lands here, so a single blip does not
// flash the banner. Requests that merely got a refusal (401/404/409/422/500) are NOT outages and
// leave the flag alone — that classification lives in `isTransportFailure`.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
        queryCache: new QueryCache({
          onError: (error) => {
            if (isTransportFailure(error)) reportReachable(false);
          },
          onSuccess: () => reportReachable(true),
        }),
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
