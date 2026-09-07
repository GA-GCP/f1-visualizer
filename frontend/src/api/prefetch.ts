import { queryClient } from './queryClient';
import { queries } from './queries';

/**
 * Warms the cache during the post-login splash.
 *
 * Imported dynamically by the prefetch task list so neither the query client
 * nor the analysis API reaches the chunk the public landing page downloads.
 */
export const prefetchDrivers = () => queryClient.prefetchQuery(queries.drivers());
export const prefetchSessions = () => queryClient.prefetchQuery(queries.sessions());
