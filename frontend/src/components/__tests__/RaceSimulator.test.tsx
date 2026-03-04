import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RaceSimulator from '../RaceSimulator';
import { useTelemetry } from '@/hooks/useTelemetry.ts';
import { useLocation } from '@/hooks/useLocation.ts';
import { useUser } from '../../context/UserContext';
import { fetchDrivers } from '@/api/referenceApi.ts';

// Mock child components to isolate the container logic
vi.mock('../CircuitTrace', () => ({ default: () => <div data-testid="circuit-trace" /> }));
vi.mock('../selectors/SessionControlPanel', () => ({
    default: ({ onStreamStarted }: { onStreamStarted: (key: number, mode: string) => void }) => (
        <button onClick={() => onStreamStarted(9165, 'LIVE')}>Start Mock Stream</button>
    )
}));
vi.mock('../MediaController', () => ({ default: () => <div /> }));

// Mock hooks
vi.mock('../../hooks/useTelemetry');
vi.mock('../../hooks/useLocation');
vi.mock('../../context/UserContext');
vi.mock('../../api/referenceApi');

describe('RaceSimulator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useUser).mockReturnValue({ userProfile: null, isLoading: false, updatePreferences: vi.fn(), error: null });
        vi.mocked(fetchDrivers).mockResolvedValue([]);
    });

    it('displays CONNECTION LOST alert if stream is active but sockets disconnect', async () => {
        // Arrange: Sockets are disconnected
        vi.mocked(useTelemetry).mockReturnValue({ isConnected: false });
        vi.mocked(useLocation).mockReturnValue({ isConnected: false });

        render(<RaceSimulator />);

        // Act: Start a session
        screen.getByText('Start Mock Stream').click();

        // Assert: The global error banner should appear because we have an active session but no socket connection
        expect(await screen.findByText(/CRITICAL: LIVE FEED CONNECTION LOST/i)).toBeInTheDocument();
    });
});