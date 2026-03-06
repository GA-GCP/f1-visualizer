import { apiClient } from './apiClient';
import type { LapDataRecord } from '../types/telemetry';

export interface DriverProfile {
    id: number;
    code: string;
    name: string;
    team: string;
    teamColor: string;
    stats: { speed: number; consistency: number; aggression: number; tireMgmt: number; experience: number; wins: number; podiums: number; };
}

export interface RaceSession {
    sessionKey: number; // Note the camelCase switch!
    sessionName: string;
    meetingName: string;
    year: number;
    countryName: string;
}

// ── Request deduplication + in-memory cache ──
// Multiple components (RaceSimulator, VersusMode, HistoricalData, SessionControlPanel)
// independently call fetchDrivers()/fetchSessions() on mount.  React StrictMode
// doubles each call.  Without dedup, 6-8 concurrent requests fire on page load,
// triggering the backend rate limiter (429) which cascades to block STOMP WebSocket
// connections — killing the Circuit Trace live feed.
let driversCache: DriverProfile[] | null = null;
let driversInflight: Promise<DriverProfile[]> | null = null;

let sessionsCache: RaceSession[] | null = null;
let sessionsInflight: Promise<RaceSession[]> | null = null;

export const fetchDrivers = async (): Promise<DriverProfile[]> => {
    if (driversCache) return driversCache;
    if (driversInflight) return driversInflight;

    driversInflight = apiClient.get('/analysis/drivers').then(res => {
        driversCache = res.data;
        driversInflight = null;
        return res.data as DriverProfile[];
    }).catch(err => {
        driversInflight = null;
        throw err;
    });

    return driversInflight;
};

export const fetchSessions = async (): Promise<RaceSession[]> => {
    if (sessionsCache) return sessionsCache;
    if (sessionsInflight) return sessionsInflight;

    sessionsInflight = apiClient.get('/analysis/sessions').then(res => {
        // v1.0: Only Race sessions have lap data in BigQuery.
        // Practice/Qualifying/Sprint will be added in v1.1.
        const raceOnly = (res.data as RaceSession[]).filter(s => s.sessionName === 'Race');
        sessionsCache = raceOnly;
        sessionsInflight = null;
        return raceOnly;
    }).catch(err => {
        sessionsInflight = null;
        throw err;
    });

    return sessionsInflight;
};

export const searchSessions = async (query: string): Promise<RaceSession[]> => {
    const res = await apiClient.get(`/analysis/sessions/search?query=${encodeURIComponent(query)}`);
    return res.data;
};

export const fetchDriverStats = async (driverId: number): Promise<DriverProfile['stats']> => {
    const res = await apiClient.get(`/analysis/drivers/${driverId}/stats`);
    return res.data;
};

export const fetchSessionLaps = async (sessionKey: number): Promise<LapDataRecord[]> => {
    const res = await apiClient.get(`/analysis/session/${sessionKey}/laps`);
    return res.data;
};