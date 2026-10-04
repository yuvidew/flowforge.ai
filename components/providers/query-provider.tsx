"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * @component QueryProvider
 * @description Supplies a single TanStack QueryClient to the client tree; mounted once in the root layout.
 */
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  // One client per browser session — created lazily so it survives re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Avoid refetching on every mount/focus for data that rarely changes.
            staleTime: 30 * 1000,
            // Retrying 4xx responses (auth, not found, bad input) never helps; retry network/5xx up to 2 times.
            retry: (failureCount, error) => {
              const status = isAxiosError(error) ? error.response?.status : undefined;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
