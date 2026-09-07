import { apiClient } from './apiClient';
import {
    driverProfileSchema,
    driverStatsSchema,
    lapDataRecordSchema,
    raceEntryRosterSchema,
    raceSessionSchema,
    type DriverProfile,
    type LapDataRecord,
    type RaceEntryRoster,
    type RaceSession,
} from './schemas';
import { parseResponse } from './parseResponse';
import * as z from 'zod/mini';

export type {
    DriverProfile,
    RaceSession,
    SessionDriverEntry,
    RaceEntryRoster,
} from './schemas';

// Plain fetchers. Caching, de-duplication, staleness and invalidation are
// TanStack Query's job now (see queries.ts) — the module-level caches this
// replaces never expired and could not be invalidated, and the failure cooldown
// they used to share is covered by the query retry policy plus the jittered,
// idempotent-only retry in apiClient.
//
// De-duplication still matters for the same reason it did before: several
// components request the driver list on mount and StrictMode doubles each call,
// which without dedup fired six to eight concurrent requests on page load and
// tripped the gateway's rate limiter. Query dedupes by key.

export const fetchDrivers = async (signal?: AbortSignal): Promise<DriverProfile[]> => {
    const res = await apiClient.get('/analysis/drivers', { signal });
    return parseResponse(z.array(driverProfileSchema), res.data, 'GET /analysis/drivers');
};

export const fetchSessions = async (signal?: AbortSignal): Promise<RaceSession[]> => {
    const res = await apiClient.get('/analysis/sessions', { signal });
    // v1.0: Only Race sessions have lap data in BigQuery.
    // Practice/Qualifying/Sprint will be added in v1.1.
    return parseResponse(z.array(raceSessionSchema), res.data, 'GET /analysis/sessions')
        .filter(session => session.sessionName === 'Race');
};

export const fetchYears = async (signal?: AbortSignal): Promise<number[]> => {
    const res = await apiClient.get('/analysis/years', { signal });
    return parseResponse(z.array(z.number()), res.data, 'GET /analysis/years');
};

export const searchSessions = async (query: string, signal?: AbortSignal): Promise<RaceSession[]> => {
    const res = await apiClient.get(`/analysis/sessions/search?query=${encodeURIComponent(query)}`, { signal });
    return parseResponse(z.array(raceSessionSchema), res.data, 'GET /analysis/sessions/search');
};

export const fetchDriverStats = async (driverId: number, signal?: AbortSignal): Promise<DriverProfile['stats']> => {
    const res = await apiClient.get(`/analysis/drivers/${driverId}/stats`, { signal });
    return parseResponse(driverStatsSchema, res.data, 'GET /analysis/drivers/:id/stats');
};

export const fetchSessionLaps = async (sessionKey: number, signal?: AbortSignal): Promise<LapDataRecord[]> => {
    const res = await apiClient.get(`/analysis/session/${sessionKey}/laps`, { signal });
    return parseResponse(z.array(lapDataRecordSchema), res.data, 'GET /analysis/session/:key/laps');
};

// ── Season-aware API functions ──

export const fetchSessionsByYear = async (year: number, signal?: AbortSignal): Promise<RaceSession[]> => {
    const res = await apiClient.get(`/analysis/sessions/year/${year}`, { signal });
    return parseResponse(z.array(raceSessionSchema), res.data, 'GET /analysis/sessions/year/:year');
};

export const fetchSessionDrivers = async (sessionKey: number, signal?: AbortSignal): Promise<RaceEntryRoster> => {
    const res = await apiClient.get(`/analysis/sessions/${sessionKey}/drivers`, { signal });
    return parseResponse(raceEntryRosterSchema, res.data, 'GET /analysis/sessions/:key/drivers');
};