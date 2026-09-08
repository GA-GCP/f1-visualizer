import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDrivers } from '@/api/referenceApi';
import type { DriverProfile } from '@/api/schemas';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useUser } from '../../context/UserContext';
import UserSettingsModal from '../layout/UserSettingsModal';

// Mock contexts and APIs
vi.mock('../../context/UserContext', () => ({
    useUser: vi.fn()
}));

vi.mock('../../api/referenceApi', () => ({
    fetchDrivers: vi.fn(),
    fetchSessions: vi.fn(),
    fetchYears: vi.fn(),
    fetchSessionsByYear: vi.fn(),
    fetchSessionLaps: vi.fn(),
    fetchSessionDrivers: vi.fn(),
    fetchDriverStats: vi.fn(),
    searchSessions: vi.fn(),
}));

describe('UserSettingsModal', () => {
    const mockUpdatePreferences = vi.fn();
    // `stats` is required by DriverProfile and was missing here. Nothing caught
    // it because the mock was reached through a double cast — the fixture was
    // not a DriverProfile and the test asserted against a shape the API cannot
    // return. Typed explicitly so the next schema change fails here.
    const stats: DriverProfile['stats'] = {
        speed: 90, consistency: 88, aggression: 82, tireMgmt: 85, experience: 87,
        wins: 5, podiums: 40, totalPoints: 1200, bestChampionshipFinish: 2,
        totalRaces: 150, teamsDrivenFor: ['Ferrari'],
    };
    const mockDrivers: DriverProfile[] = [
        { id: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", teamColor: "#E80020", stats },
        { id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull", teamColor: "#3671C6", stats }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // vi.mocked keeps each mock's real signature. The previous double cast
        // was there "to bypass strict vi.mocked() TS errors" — those errors
        // were the fixture genuinely not matching DriverProfile.
        vi.mocked(fetchDrivers).mockResolvedValue(mockDrivers);
        vi.mocked(useUser).mockReturnValue({
            // Same story: authSubId, email and createdAt are required by
            // UserProfile and were absent, hidden by the cast.
            userProfile: {
                authSubId: 'auth0|test-user',
                email: 'test@example.com',
                createdAt: '2025-01-01T00:00:00Z',
                preferences: { favoriteDriver: 'LEC' },
            },
            updatePreferences: mockUpdatePreferences,
            isLoading: false,
            error: null,
        });
    });

    it('shows the spinner while drivers load, then serves a reopen from cache', async () => {
        let resolveFetch: (drivers: typeof mockDrivers) => void = () => {};
        vi.mocked(fetchDrivers).mockImplementation(
            () => new Promise(resolve => { resolveFetch = resolve; })
        );

        const { rerender } = renderWithProviders(<UserSettingsModal open={true} onClose={vi.fn()} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        await act(async () => { resolveFetch(mockDrivers); });
        await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

        // The roster is cached now, so reopening shows the list immediately
        // rather than a second spinner and a second request.
        rerender(<UserSettingsModal open={false} onClose={vi.fn()} />);
        rerender(<UserSettingsModal open={true} onClose={vi.fn()} />);
        // No second spinner: cached data renders immediately. (Whether a
        // background refetch also happens is a staleTime question, asserted
        // against the real client in queryClient.test.ts, not here — the test
        // client deliberately uses staleTime 0 for determinism.)
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('pre-selects the existing favorite driver and saves updates', async () => {
        renderWithProviders(<UserSettingsModal open={true} onClose={vi.fn()} />);

        // Verify pre-selection logic works
        await waitFor(() => {
            expect(screen.getByDisplayValue('LEC - Charles Leclerc')).toBeInTheDocument();
        });

        // Click Save
        fireEvent.click(screen.getByRole('button', { name: /SAVE SETTINGS/i }));

        // Verify it sent the right data
        await waitFor(() => {
            expect(mockUpdatePreferences).toHaveBeenCalledWith({
                favoriteDriver: 'LEC'
            });
        });
    });
});