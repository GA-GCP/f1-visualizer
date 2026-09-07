import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the module under test
vi.mock('../apiClient', () => ({
    apiClient: {
        get: vi.fn(),
    },
    // De-duplicated fetchers wrap their shared promise so one caller aborting
    // does not cancel the request the others are waiting on.
    abortable: <T,>(promise: Promise<T>) => promise,
    isRequestCancelled: () => false,
}));

import { apiClient } from '../apiClient';

/**
 * Complete wire-shaped fixtures.
 *
 * Responses are validated against the schemas now, so a fixture that omits
 * fields is rejected — which is the point: the partial objects these tests used
 * to pass were not shapes the backend ever sends.
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
        // Each test gets a fresh module so the in-memory caches are cleared
        vi.resetModules();
        vi.clearAllMocks();
    });

    describe('fetchDrivers', () => {
        it('fetches drivers from the API on first call', async () => {
            const mockDrivers = [driver()];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockDrivers });

            const { fetchDrivers } = await import('../referenceApi');
            const result = await fetchDrivers();

            expect(apiClient.get).toHaveBeenCalledWith('/analysis/drivers');
            expect(result).toEqual(mockDrivers);
        });

        it('returns cached drivers on subsequent calls without hitting API', async () => {
            const mockDrivers = [driver()];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockDrivers });

            const { fetchDrivers } = await import('../referenceApi');
            await fetchDrivers();
            const result = await fetchDrivers();

            expect(apiClient.get).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockDrivers);
        });

        it('deduplicates concurrent inflight requests', async () => {
            const mockDrivers = [driver()];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockDrivers });

            const { fetchDrivers } = await import('../referenceApi');

            const [r1, r2] = await Promise.all([fetchDrivers(), fetchDrivers()]);

            expect(apiClient.get).toHaveBeenCalledTimes(1);
            expect(r1).toEqual(mockDrivers);
            expect(r2).toEqual(mockDrivers);
        });
    });

    describe('fetchSessions', () => {
        it('fetches sessions and filters to Race only', async () => {
            const allSessions = [
                { sessionKey: 1, sessionName: 'Race', meetingName: 'Bahrain GP', year: 2024, countryName: 'Bahrain' },
                { sessionKey: 2, sessionName: 'Qualifying', meetingName: 'Bahrain GP', year: 2024, countryName: 'Bahrain' },
                { sessionKey: 3, sessionName: 'Race', meetingName: 'Saudi GP', year: 2024, countryName: 'Saudi Arabia' },
            ];
            vi.mocked(apiClient.get).mockResolvedValue({ data: allSessions });

            const { fetchSessions } = await import('../referenceApi');
            const result = await fetchSessions();

            expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions');
            expect(result).toHaveLength(2);
            expect(result.every((s: { sessionName: string }) => s.sessionName === 'Race')).toBe(true);
        });

        it('returns cached sessions on repeat calls', async () => {
            vi.mocked(apiClient.get).mockResolvedValue({ data: [session()] });

            const { fetchSessions } = await import('../referenceApi');
            await fetchSessions();
            await fetchSessions();

            expect(apiClient.get).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchSessions', () => {
        it('calls the search endpoint with URL-encoded query', async () => {
            const mockResults = [session({ meetingName: 'Bahrain GP' })];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockResults });

            const { searchSessions } = await import('../referenceApi');
            const result = await searchSessions('Bahrain GP');

            expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions/search?query=Bahrain%20GP', { signal: undefined });
            expect(result).toEqual(mockResults);
        });
    });

    describe('fetchDriverStats', () => {
        it('fetches driver stats by ID', async () => {
            const mockStats = stats;
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockStats });

            const { fetchDriverStats } = await import('../referenceApi');
            const result = await fetchDriverStats(1);

            expect(apiClient.get).toHaveBeenCalledWith('/analysis/drivers/1/stats', { signal: undefined });
            expect(result).toEqual(mockStats);
        });
    });

    describe('fetchSessionLaps', () => {
        it('fetches laps for a given session key', async () => {
            const mockLaps = [{ driverNumber: 1, lapNumber: 5, lapDuration: 85.5 }];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockLaps });

            const { fetchSessionLaps } = await import('../referenceApi');
            const result = await fetchSessionLaps(9165);

            expect(apiClient.get).toHaveBeenCalledWith('/analysis/session/9165/laps', { signal: undefined });
            expect(result).toEqual(mockLaps);
        });
    });

    describe('fetchYears', () => {
        it('fetches available years and caches the result', async () => {
            vi.mocked(apiClient.get).mockResolvedValue({ data: [2024, 2023] });

            const { fetchYears } = await import('../referenceApi');
            const r1 = await fetchYears();
            const r2 = await fetchYears();

            expect(apiClient.get).toHaveBeenCalledTimes(1);
            expect(r1).toEqual([2024, 2023]);
            expect(r2).toEqual([2024, 2023]);
        });
    });

    describe('fetchSessionsByYear', () => {
        it('fetches sessions for a specific year and caches per year', async () => {
            const mockSessions = [session({ year: 2024 })];
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockSessions });

            const { fetchSessionsByYear } = await import('../referenceApi');
            const r1 = await fetchSessionsByYear(2024);
            const r2 = await fetchSessionsByYear(2024);

            expect(apiClient.get).toHaveBeenCalledTimes(1);
            expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions/year/2024', { signal: undefined });
            expect(r1).toEqual(mockSessions);
            expect(r2).toEqual(mockSessions);
        });
    });

    describe('fetchSessionDrivers', () => {
        it('fetches session drivers and caches per session key', async () => {
            const mockRoster = {
                sessionKey: 9165, year: 2024,
                drivers: [{
                    driverNumber: 1, broadcastName: 'M VERSTAPPEN', nameAcronym: 'VER',
                    teamName: 'Red Bull', teamColour: '3671C6', countryCode: 'NED',
                }],
            };
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockRoster });

            const { fetchSessionDrivers } = await import('../referenceApi');
            const r1 = await fetchSessionDrivers(9165);
            const r2 = await fetchSessionDrivers(9165);

            expect(apiClient.get).toHaveBeenCalledTimes(1);
            expect(apiClient.get).toHaveBeenCalledWith('/analysis/sessions/9165/drivers', { signal: undefined });
            expect(r1).toEqual(mockRoster);
            expect(r2).toEqual(mockRoster);
        });
    });
});
