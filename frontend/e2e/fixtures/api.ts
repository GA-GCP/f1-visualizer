import { E2E_EMAIL, E2E_SUB } from './auth0';
import type { Page } from '@playwright/test';

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

/**
 * Answers every REST call the app makes, matching on the path suffix.
 *
 * A single catch-all with an explicit table rather than one route per endpoint:
 * an unmatched call falls through to the 404 below and fails the test loudly,
 * instead of hanging until the spec times out with no indication of which
 * request was missing.
 */
export async function stubApi(page: Page): Promise<void> {
    await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;

        const body = path.endsWith('/analysis/drivers')
            ? DRIVERS
            : path.endsWith('/analysis/sessions')
              ? SESSIONS
              : path.endsWith('/analysis/years')
                ? [2025, 2024]
                : /\/analysis\/sessions\/year\/\d+$/.test(path)
                  ? SESSIONS
                  : /\/analysis\/sessions\/\d+\/drivers$/.test(path)
                    ? SESSION_DRIVERS
                    : /\/analysis\/session\/\d+\/laps$/.test(path)
                      ? LAPS
                      : /\/analysis\/drivers\/\d+\/stats$/.test(path)
                        ? DRIVERS[0].stats
                        : path.endsWith('/users/me')
                          ? USER_PROFILE
                          : path.endsWith('/users/me/preferences')
                            ? USER_PROFILE.preferences
                            : path.includes('/ingestion/')
                              ? { status: 'accepted' }
                              : null;

        if (body === null) {
            await route.fulfill({ status: 404, json: { error: `no e2e stub for ${path}` } });
            return;
        }

        await route.fulfill({ json: body });
    });
}
