import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserSettingsModal from '../layout/UserSettingsModal';
import { useUser } from '../../context/UserContext';
import { fetchDrivers } from '@/api/referenceApi.ts';

// Mock contexts and APIs
vi.mock('../../context/UserContext', () => ({
    useUser: vi.fn()
}));

vi.mock('../../api/referenceApi', () => ({
    fetchDrivers: vi.fn()
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

    it('shows the spinner while drivers load, and again when reopened', async () => {
        let resolveFetch: (drivers: typeof mockDrivers) => void = () => {};
        (fetchDrivers as unknown as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise(resolve => { resolveFetch = resolve; })
        );

        const { rerender } = render(<UserSettingsModal open={true} onClose={vi.fn()} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        await act(async () => { resolveFetch(mockDrivers); });
        await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

        // Closing discards the fetched data, so reopening loads from scratch.
        rerender(<UserSettingsModal open={false} onClose={vi.fn()} />);
        rerender(<UserSettingsModal open={true} onClose={vi.fn()} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('pre-selects the existing favorite driver and saves updates', async () => {
        render(<UserSettingsModal open={true} onClose={vi.fn()} />);

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