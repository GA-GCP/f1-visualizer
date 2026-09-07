import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the module under test
vi.mock('../apiClient', () => ({
    apiClient: { get: vi.fn() },
}));

import { apiClient } from '../apiClient';
import {
    fetchDrivers,
    fetchDriverStats,
    fetchSessionDrivers,
    fetchSessionLaps,
    fetchSessions,
    fetchSessionsByYear,
    fetchYears,
    searchSessions,
} from '../referenceApi';

/**
 * These are plain fetchers now.
 *
 * Caching, de-duplication, staleness and invalidation moved to TanStack Query
 * (see queries.ts), so the tests that used to assert a module-level cache and a
 * shared in-flight promise are gone with the code they described.
 */
const stats = {
    speed: 90, consistency: 85, aggression: 70, tireMgmt: 80, experience: 95,
    wins: 5, podiums: 12, totalPoints: 400, bestChampionshipFinish: 2,
    totalRaces: 100, teamsDrivenFor: ['Red Bull'],
};
const driver = (over: Record<string, unknown> = {}) => ({
    id: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', teamColor: '3671C6', stats, ...over,
});
const session = (over: Record<string, unknown> = {}) => ({
    sessionKey: 1, sessionName: 'Race', meetingName: 'Bahrain GP', year: 2024, countryName: 'Bahrain', ...over,
});

describe('referenceApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches drivers', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [driver()] });

        const result = await fetchDrivers();

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/drivers', { signal: undefined });
        expect(result).toEqual([driver()]);
    });

    it('passes an abort signal through', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [driver()] });
        const controller = new AbortController();

        await fetchDrivers(controller.signal);

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/drivers', { signal: controller.signal });
    });

    it('does not cache: every call is a request, because Query owns caching now', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [driver()] });

        await fetchDrivers();
        await fetchDrivers();

        expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it('filters sessions to races only', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({
            data: [
                session({ sessionKey: 1, sessionName: 'Race' }),
                session({ sessionKey: 2, sessionName: 'Qualifying' }),
                session({ sessionKey: 3, sessionName: 'Race' }),
            ],
        });

        const result = await fetchSessions();

        expect(result).toHaveLength(2);
        expect(result.every(s => s.sessionName === 'Race')).toBe(true);
    });

    it('URL-encodes a search query', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [session()] });

        await searchSessions('Bahrain GP');

        expect(apiClient.get).toHaveBeenCalledWith(
            '/analysis/sessions/search?query=Bahrain%20GP',
            { signal: undefined },
        );
    });

    it('fetches driver stats by id', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: stats });

        const result = await fetchDriverStats(1);

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/drivers/1/stats', { signal: undefined });
        expect(result).toEqual(stats);
    });

    it('fetches laps for a session', async () => {
        const laps = [{ driverNumber: 1, lapNumber: 5, lapDuration: 85.5 }];
        vi.mocked(apiClient.get).mockResolvedValue({ data: laps });

        const result = await fetchSessionLaps(9165);

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/session/9165/laps', { signal: undefined });
        expect(result).toEqual(laps);
    });

    it('fetches available years', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [2024, 2023] });

        expect(await fetchYears()).toEqual([2024, 2023]);
    });

    it('fetches sessions for a year', async () => {
        vi.mocked(apiClient.get).mockResolvedValue({ data: [session({ year: 2024 })] });

        await fetchSessionsByYear(2024);

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions/year/2024', { signal: undefined });
    });

    it('fetches a session roster', async () => {
        const roster = {
            sessionKey: 9165, year: 2024,
            drivers: [{
                driverNumber: 1, broadcastName: 'M VERSTAPPEN', nameAcronym: 'VER',
                teamName: 'Red Bull', teamColour: '3671C6', countryCode: 'NED',
            }],
        };
        vi.mocked(apiClient.get).mockResolvedValue({ data: roster });

        const result = await fetchSessionDrivers(9165);

        expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions/9165/drivers', { signal: undefined });
        expect(result).toEqual(roster);
    });

    it('rejects a response that does not match the schema', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 1, code: 'VER' }] });

        await expect(fetchDrivers()).rejects.toThrow(/did not match/i);
    });
});
