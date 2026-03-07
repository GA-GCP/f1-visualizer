import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RaceSimulator from '../RaceSimulator';
import { useTelemetry } from '@/hooks/useTelemetry.ts';
import { useLocation } from '@/hooks/useLocation.ts';
import { useUser } from '../../context/UserContext';
import { fetchDrivers } from '@/api/referenceApi.ts';
import type { TelemetryPacket } from '@/types/telemetry.ts';

const mockRaceSession = {
    sessionKey: 9165,
    sessionName: 'Race',
    meetingName: 'Bahrain Grand Prix',
    year: 2024,
    countryName: 'Bahrain',
};

// Mock child components to isolate the container logic
vi.mock('../CircuitTrace', () => ({ default: () => <div data-testid="circuit-trace" /> }));
vi.mock('../selectors/SessionControlPanel', () => ({
    default: ({ onStreamStarted }: { onStreamStarted: (key: number, mode: string, session: typeof mockRaceSession) => void }) => (
        <button onClick={() => onStreamStarted(9165, 'LIVE', mockRaceSession)}>Start Mock Stream</button>
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

    it('renders BRAKE and DRS values when telemetry is active', async () => {
        const mockTelemetry: TelemetryPacket = {
            session_key: 9165,
            meeting_key: 1,
            date: '2024-01-01',
            driver_number: 1,
            speed: 310,
            rpm: 11500,
            gear: 7,
            throttle: 100,
            brake: 0,
            drs: 1,
        };

        // Capture the latest telemetry callback on each render
        let telemetryCallback: ((data: TelemetryPacket) => void) | undefined;
        vi.mocked(useTelemetry).mockImplementation((cb) => {
            telemetryCallback = cb;
            return { isConnected: true };
        });
        vi.mocked(useLocation).mockReturnValue({ isConnected: true });
        vi.mocked(fetchDrivers).mockResolvedValue([
            { id: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', teamColor: '#3671C6', stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98 } }
        ]);

        render(<RaceSimulator />);

        // Wait for drivers to load so selectedDriver is populated in the closure
        await waitFor(() => {
            expect(fetchDrivers).toHaveBeenCalled();
        });
        // Allow the async fetchDrivers resolution + re-render to complete
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Start stream (sets activeSession)
        await act(async () => {
            screen.getByText('Start Mock Stream').click();
        });

        // Now trigger telemetry callback — the latest callback has the correct closures
        act(() => {
            telemetryCallback?.(mockTelemetry);
        });

        // Assert brake and DRS values
        expect(await screen.findByText('0%')).toBeInTheDocument();
        expect(await screen.findByText('ACTIVATED')).toBeInTheDocument();
    });

    it('shows DRS OFF when drs value is 0', async () => {
        const mockTelemetry: TelemetryPacket = {
            session_key: 9165,
            meeting_key: 1,
            date: '2024-01-01',
            driver_number: 1,
            speed: 200,
            rpm: 9000,
            gear: 5,
            throttle: 60,
            brake: 50,
            drs: 0,
        };

        let telemetryCallback: ((data: TelemetryPacket) => void) | undefined;
        vi.mocked(useTelemetry).mockImplementation((cb) => {
            telemetryCallback = cb;
            return { isConnected: true };
        });
        vi.mocked(useLocation).mockReturnValue({ isConnected: true });
        vi.mocked(fetchDrivers).mockResolvedValue([
            { id: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', teamColor: '#3671C6', stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98 } }
        ]);

        render(<RaceSimulator />);

        // Wait for drivers to load
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });

        // Start stream
        await act(async () => {
            screen.getByText('Start Mock Stream').click();
        });

        // Trigger telemetry
        act(() => {
            telemetryCallback?.(mockTelemetry);
        });

        expect(await screen.findByText('OFF')).toBeInTheDocument();
        expect(await screen.findByText('50%')).toBeInTheDocument();
    });
});
