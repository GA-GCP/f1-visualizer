import { E2E_EMAIL, E2E_SUB } from './auth0';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Fixture payloads.
 *
 * These have to satisfy the zod schemas in src/api/schemas.ts exactly — the
 * client rejects a mismatched shape with SchemaMismatchError rather than
 * rendering it. That makes the fixtures a second, independent check on the
 * wire contract: if a schema changes and these are not updated, the e2e run
 * fails, which is the point.
 */
export const DRIVERS = [
    {
        id: 1,
        code: 'VER',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        teamColor: '#3671C6',
        stats: {
            speed: 95,
            consistency: 92,
            aggression: 88,
            tireMgmt: 90,
            experience: 93,
            wins: 62,
            podiums: 108,
            totalPoints: 2900,
            bestChampionshipFinish: 1,
            totalRaces: 200,
            teamsDrivenFor: ['Toro Rosso', 'Red Bull Racing'],
        },
    },
    {
        id: 4,
        code: 'NOR',
        name: 'Lando Norris',
        team: 'McLaren',
        teamColor: '#F58020',
        stats: {
            speed: 92,
            consistency: 89,
            aggression: 84,
            tireMgmt: 87,
            experience: 80,
            wins: 4,
            podiums: 26,
            totalPoints: 1100,
            bestChampionshipFinish: 2,
            totalRaces: 130,
            teamsDrivenFor: ['McLaren'],
        },
    },
];

export const SESSIONS = [
    {
        sessionKey: 9001,
        sessionName: 'Race',
        meetingName: 'Bahrain Grand Prix',
        year: 2025,
        countryName: 'Bahrain',
    },
    {
        sessionKey: 9002,
        sessionName: 'Qualifying',
        meetingName: 'Bahrain Grand Prix',
        year: 2025,
        countryName: 'Bahrain',
    },
];

export const SESSION_DRIVERS = {
    sessionKey: 9001,
    year: 2025,
    drivers: [
        {
            driverNumber: 1,
            broadcastName: 'M VERSTAPPEN',
            nameAcronym: 'VER',
            teamName: 'Red Bull Racing',
            teamColour: '3671C6',
            countryCode: 'NED',
        },
        {
            driverNumber: 4,
            broadcastName: 'L NORRIS',
            nameAcronym: 'NOR',
            teamName: 'McLaren',
            teamColour: 'F58020',
            countryCode: 'GBR',
        },
    ],
};

export const LAPS = Array.from({ length: 12 }, (_, i) => ({
    driverNumber: 1,
    lapNumber: i + 1,
    lapDuration: 92.4 + Math.sin(i) * 0.8,
    sector1: 30.1,
    sector2: 31.2,
    sector3: 31.1,
    compound: 'SOFT',
    dateStart: new Date(Date.UTC(2025, 2, 2, 15, i)).toISOString(),
    isPitOutLap: false,
}));

/** The second driver's stint over the same laps, so a lap chart has two lines to set apart. */
const LAPS_NOR = LAPS.map((lap, i) => ({
    ...lap,
    driverNumber: 4,
    lapDuration: 92.9 + Math.cos(i / 2) * 0.6 - i * 0.03,
    compound: i < 7 ? 'MEDIUM' : 'HARD',
}));

export const USER_PROFILE = {
    authSubId: E2E_SUB,
    email: E2E_EMAIL,
    createdAt: '2025-01-01T00:00:00Z',
    preferences: {
        favoriteDriver: 'VER',
        team: 'Red Bull Racing',
        defaultTelemetryView: 'speed',
        savedQueries: [],
    },
};

/** The answer the API gives `path`, or null where it has none. */
function answerFor(path: string): unknown {
    if (path.endsWith('/analysis/drivers')) return DRIVERS;
    if (path.endsWith('/analysis/sessions')) return SESSIONS;
    if (path.endsWith('/analysis/years')) return [2025, 2024];
    if (/\/analysis\/sessions\/year\/\d+$/.test(path)) return SESSIONS;
    if (/\/analysis\/sessions\/\d+\/drivers$/.test(path)) return SESSION_DRIVERS;
    if (/\/analysis\/session\/\d+\/laps$/.test(path)) return [...LAPS, ...LAPS_NOR];
    const stats = /\/analysis\/drivers\/(\d+)\/stats$/.exec(path);
    if (stats)
        return (DRIVERS.find((driver) => driver.id === Number(stats[1])) ?? DRIVERS[0]).stats;
    if (path.endsWith('/users/me')) return USER_PROFILE;
    if (path.endsWith('/users/me/preferences')) return USER_PROFILE.preferences;
    if (path.includes('/ingestion/')) return { status: 'accepted' };
    return null;
}

/**
 * Answers every REST call the app makes under /api/v1, matching on the path,
 * on the same origin as the app: .env.e2e leaves VITE_API_BASE_URL unset, so
 * the app calls the relative /api/v1 exactly as it derives it in production.
 * Each driver's stats are its own and the laps are both drivers', so the Data
 * Vault and Head-to-Head screenshots have two drivers to compare.
 *
 * A table rather than a route per endpoint: an unmatched call gets the 404
 * below and fails the test loudly, instead of hanging until the test times out
 * with no indication of which request was missing.
 */
export function answerApi(request: IncomingMessage, response: ServerResponse): void {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const body = answerFor(path);
    response.writeHead(body === null ? 404 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body ?? { error: `no e2e stand-in for ${path}` }));
}
