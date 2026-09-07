import { QueryClient } from '@tanstack/react-query';

/**
 * The single query client.
 *
 * A module singleton rather than component state so the splash prefetch can
 * warm the cache before any provider has mounted. Nothing in the public route
 * imports this file, which is what keeps the library out of the entry chunk.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Reference data (drivers, sessions, years) changes on a release
            // cadence, not a request cadence. The hand-rolled caches this
            // replaces never expired at all.
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            // apiClient already applies a jittered, idempotent-only retry policy
            // with Retry-After support; a second layer would multiply attempts.
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});
