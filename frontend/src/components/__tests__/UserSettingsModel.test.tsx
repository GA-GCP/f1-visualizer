import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserSettingsModal from '../layout/UserSettingsModal';
import { useUser } from '../../context/UserContext';
import { fetchDrivers } from '@/api/referenceApi.ts';

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
    const mockDrivers = [
        { id: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", teamColor: "#E80020" },
        { id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull", teamColor: "#3671C6" }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Use direct casting to bypass strict vi.mocked() TS errors
        (fetchDrivers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDrivers);
        (useUser as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            userProfile: { preferences: { favoriteDriver: 'LEC' } },
            updatePreferences: mockUpdatePreferences,
            isLoading: false
        });
    });

    it('shows the spinner while drivers load, then serves a reopen from cache', async () => {
        let resolveFetch: (drivers: typeof mockDrivers) => void = () => {};
        (fetchDrivers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
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