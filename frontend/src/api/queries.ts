import { queryOptions } from '@tanstack/react-query';
import {
    fetchDrivers,
    fetchDriverStats,
    fetchSessionDrivers,
    fetchSessionLaps,
    fetchSessions,
    fetchSessionsByYear,
    fetchYears,
} from './referenceApi';

/**
 * Query definitions, shared by components and by the splash prefetch.
 *
 * Replaces three differently-shaped hand-rolled caches: two module-level
 * `cache`/`inflight` pairs with a failure cooldown, and two bare `Map`s that
 * never expired and had no way to be invalidated.
 */
export const queries = {
    drivers: () =>
        queryOptions({
            queryKey: ['drivers'] as const,
            queryFn: ({ signal }) => fetchDrivers(signal),
        }),

    sessions: () =>
        queryOptions({
            queryKey: ['sessions'] as const,
            queryFn: ({ signal }) => fetchSessions(signal),
        }),

    years: () =>
        queryOptions({
            queryKey: ['years'] as const,
            queryFn: ({ signal }) => fetchYears(signal),
        }),

    sessionsByYear: (year: number) =>
        queryOptions({
            queryKey: ['sessions', 'year', year] as const,
            queryFn: ({ signal }) => fetchSessionsByYear(year, signal),
        }),

    sessionLaps: (sessionKey: number) =>
        queryOptions({
            queryKey: ['session', sessionKey, 'laps'] as const,
            queryFn: ({ signal }) => fetchSessionLaps(sessionKey, signal),
        }),

    sessionDrivers: (sessionKey: number) =>
        queryOptions({
            queryKey: ['session', sessionKey, 'drivers'] as const,
            queryFn: ({ signal }) => fetchSessionDrivers(sessionKey, signal),
        }),

    driverStats: (driverId: number) =>
        queryOptions({
            queryKey: ['driver', driverId, 'stats'] as const,
            queryFn: ({ signal }) => fetchDriverStats(driverId, signal),
        }),
};
