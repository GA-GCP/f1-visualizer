import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RaceSimulator from '../RaceSimulator';
import { useTelemetry } from '@/hooks/useTelemetry.ts';
import { useLocation } from '@/hooks/useLocation.ts';
import { useUser } from '../../context/UserContext';
import { fetchDrivers, fetchSessionLaps } from '@/api/referenceApi.ts';
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
        vi.mocked(fetchSessionLaps).mockResolvedValue([]);
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

    it('displays lap counter when lap data is available', async () => {
        vi.mocked(fetchSessionLaps).mockResolvedValue([
            { driverNumber: 1, lapNumber: 0, dateStart: '2024-01-01T00:00:00Z', isPitOutLap: false, compound: 'SOFT' },
            { driverNumber: 1, lapNumber: 1, dateStart: '2024-01-01T00:02:00Z', isPitOutLap: false, compound: 'SOFT' },
            { driverNumber: 1, lapNumber: 2, dateStart: '2024-01-01T00:03:30Z', isPitOutLap: false, compound: 'SOFT' },
        ]);

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

        await waitFor(() => { expect(fetchDrivers).toHaveBeenCalled(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });

        await act(async () => { screen.getByText('Start Mock Stream').click(); });

        // Allow fetchSessionLaps to resolve
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });

        // Trigger telemetry at a time during lap 1
        act(() => {
            telemetryCallback?.({
                session_key: 9165, meeting_key: 1, date: '2024-01-01T00:02:30.000Z',
                driver_number: 1, speed: 300, rpm: 11000, gear: 7, throttle: 100, brake: 0, drs: 0,
            });
        });

        expect(await screen.findByText(/LAP 1/)).toBeInTheDocument();
    });

    it('shows FORMATION LAP badge when lap number is 0', async () => {
        vi.mocked(fetchSessionLaps).mockResolvedValue([
            { driverNumber: 1, lapNumber: 0, dateStart: '2024-01-01T00:00:00Z', isPitOutLap: false, compound: 'SOFT' },
            { driverNumber: 1, lapNumber: 1, dateStart: '2024-01-01T00:02:00Z', isPitOutLap: false, compound: 'SOFT' },
        ]);

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

        await waitFor(() => { expect(fetchDrivers).toHaveBeenCalled(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });
        await act(async () => { screen.getByText('Start Mock Stream').click(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });

        act(() => {
            telemetryCallback?.({
                session_key: 9165, meeting_key: 1, date: '2024-01-01T00:01:00.000Z',
                driver_number: 1, speed: 200, rpm: 9000, gear: 5, throttle: 60, brake: 0, drs: 0,
            });
        });

        expect(await screen.findByText('FORMATION LAP')).toBeInTheDocument();
    });

    it('shows PIT OUT badge and compound change chip', async () => {
        vi.mocked(fetchSessionLaps).mockResolvedValue([
            { driverNumber: 1, lapNumber: 1, dateStart: '2024-01-01T00:02:00Z', isPitOutLap: false, compound: 'SOFT' },
            { driverNumber: 1, lapNumber: 2, dateStart: '2024-01-01T00:03:30Z', isPitOutLap: true, compound: 'HARD' },
        ]);

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

        await waitFor(() => { expect(fetchDrivers).toHaveBeenCalled(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });
        await act(async () => { screen.getByText('Start Mock Stream').click(); });
        await act(async () => { await new Promise(r => setTimeout(r, 0)); });

        act(() => {
            telemetryCallback?.({
                session_key: 9165, meeting_key: 1, date: '2024-01-01T00:03:45.000Z',
                driver_number: 1, speed: 280, rpm: 10000, gear: 6, throttle: 80, brake: 0, drs: 0,
            });
        });

        expect(await screen.findByText('PIT OUT')).toBeInTheDocument();
        expect(await screen.findByText(/SOFT.*HARD/)).toBeInTheDocument();
    });
});
