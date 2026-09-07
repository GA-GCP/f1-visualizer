import { abortable, apiClient } from './apiClient';
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

// ── Request deduplication + in-memory cache ──
// Multiple components (RaceSimulator, VersusMode, HistoricalData, SessionControlPanel)
// independently call fetchDrivers()/fetchSessions() on mount.  React StrictMode
// doubles each call.  Without dedup, 6-8 concurrent requests fire on page load,
// triggering the backend rate limiter (429) which cascades to block STOMP WebSocket
// connections — killing the Circuit Trace live feed.
//
// On failure the rejected promise is kept for a cooldown period so that concurrent
// callers share the same rejection instead of each spawning a brand-new request,
// which would compound the rate-limit pressure.  After the cooldown expires the
// slot is cleared and the next caller may try a fresh request.
const FAILURE_COOLDOWN_MS = 3_000;

let driversCache: DriverProfile[] | null = null;
let driversInflight: Promise<DriverProfile[]> | null = null;

let sessionsCache: RaceSession[] | null = null;
let sessionsInflight: Promise<RaceSession[]> | null = null;

export const fetchDrivers = async (signal?: AbortSignal): Promise<DriverProfile[]> => {
    if (driversCache) return driversCache;
    if (driversInflight) return abortable(driversInflight, signal);

    driversInflight = apiClient.get('/analysis/drivers').then(res => {
        const drivers = parseResponse(z.array(driverProfileSchema), res.data, 'GET /analysis/drivers');
        driversCache = drivers;
        driversInflight = null;
        return drivers;
    }).catch(err => {
        setTimeout(() => { driversInflight = null; }, FAILURE_COOLDOWN_MS);
        throw err;
    });

    return abortable(driversInflight, signal);
};

export const fetchSessions = async (signal?: AbortSignal): Promise<RaceSession[]> => {
    if (sessionsCache) return sessionsCache;
    if (sessionsInflight) return abortable(sessionsInflight, signal);

    sessionsInflight = apiClient.get('/analysis/sessions').then(res => {
        // v1.0: Only Race sessions have lap data in BigQuery.
        // Practice/Qualifying/Sprint will be added in v1.1.
        const raceOnly = parseResponse(z.array(raceSessionSchema), res.data, 'GET /analysis/sessions')
            .filter(s => s.sessionName === 'Race');
        sessionsCache = raceOnly;
        sessionsInflight = null;
        return raceOnly;
    }).catch(err => {
        setTimeout(() => { sessionsInflight = null; }, FAILURE_COOLDOWN_MS);
        throw err;
    });

    return abortable(sessionsInflight, signal);
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

let yearsCache: number[] | null = null;
let yearsInflight: Promise<number[]> | null = null;

export const fetchYears = async (signal?: AbortSignal): Promise<number[]> => {
    if (yearsCache) return yearsCache;
    if (yearsInflight) return abortable(yearsInflight, signal);

    yearsInflight = apiClient.get('/analysis/years').then(res => {
        const years = parseResponse(z.array(z.number()), res.data, 'GET /analysis/years');
        yearsCache = years;
        yearsInflight = null;
        return years;
    }).catch(err => {
        setTimeout(() => { yearsInflight = null; }, FAILURE_COOLDOWN_MS);
        throw err;
    });

    return abortable(yearsInflight, signal);
};

const sessionsByYearCache = new Map<number, RaceSession[]>();

export const fetchSessionsByYear = async (year: number, signal?: AbortSignal): Promise<RaceSession[]> => {
    const cached = sessionsByYearCache.get(year);
    if (cached) return cached;

    const res = await apiClient.get(`/analysis/sessions/year/${year}`, { signal });
    const sessions = parseResponse(z.array(raceSessionSchema), res.data, 'GET /analysis/sessions/year/:year');
    sessionsByYearCache.set(year, sessions);
    return sessions;
};

const sessionDriversCache = new Map<number, RaceEntryRoster>();

export const fetchSessionDrivers = async (sessionKey: number, signal?: AbortSignal): Promise<RaceEntryRoster> => {
    const cached = sessionDriversCache.get(sessionKey);
    if (cached) return cached;

    const res = await apiClient.get(`/analysis/sessions/${sessionKey}/drivers`, { signal });
    const roster = parseResponse(raceEntryRosterSchema, res.data, 'GET /analysis/sessions/:key/drivers');
    sessionDriversCache.set(sessionKey, roster);
    return roster;
};