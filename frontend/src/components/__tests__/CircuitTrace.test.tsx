import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import CircuitTrace from '../CircuitTrace';
import type { DriverProfile } from '@/api/referenceApi.ts';
import type { LocationPacket } from '@/types/telemetry.ts';

// Mock D3 to avoid complex SVG/scale issues in jsdom
vi.mock('d3', () => ({
    scaleLinear: () => {
        const scale = (v: number) => v;
        scale.domain = () => scale;
        scale.range = () => scale;
        return scale;
    }
}));

// Mock overlay components to isolate CircuitTrace logic
vi.mock('../CircuitTraceIdleOverlay', () => ({
    default: () => <div data-testid="idle-overlay">SELECT A RACE AND START A SIMULATION</div>
}));
vi.mock('../CircuitTraceLoadingOverlay', () => ({
    default: ({ year, meetingName, driverCode }: { year: number; meetingName: string; driverCode: string }) => (
        <div data-testid="loading-overlay">{year} {meetingName} {driverCode}</div>
    )
}));

/** Helper: creates a mutable ref pre-loaded with packets */
function makeQueueRef(packets: LocationPacket[] = []): React.RefObject<LocationPacket[]> {
    return { current: [...packets] };
}

/** Default props shared across all tests */
const defaultOverlayProps = {
    isSessionActive: true,
    isInitializing: false,
    sessionMeta: null,
    driverCode: null,
};

describe('CircuitTrace', () => {
    let mockCtx: Record<string, ReturnType<typeof vi.fn> | number | string>;

    const mockDriver: DriverProfile = {
        id: 1,
        code: 'VER',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        teamColor: '#3671C6',
        stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98, totalPoints: 2586, bestChampionshipFinish: 1, totalRaces: 185, teamsDrivenFor: ['Red Bull Racing'] }
    };

    const SESSION_KEY = 9165;

    const mockLocation: LocationPacket = {
        session_key: SESSION_KEY,
        meeting_key: 1,
        date: '2024-01-01',
        driver_number: 1,
        x: 100,
        y: 200,
        z: 0
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockCtx = {
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            fillText: vi.fn(),
            strokeStyle: '',
            fillStyle: '',
            lineWidth: 1,
            lineJoin: 'miter',
            shadowBlur: 0,
            shadowColor: '',
            font: '',
            textBaseline: ''
        };

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

        // Mock requestAnimationFrame to run one frame synchronously then stop
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            return setTimeout(() => cb(0), 16) as unknown as number;
        });

        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            clearTimeout(id);
        });
    });

    it('clears canvas on each render frame', async () => {
        const queueRef = makeQueueRef([mockLocation]);
        render(<CircuitTrace locationQueueRef={queueRef} selectedDriver={mockDriver} sessionKey={SESSION_KEY} resetKey={0} {...defaultOverlayProps} />);

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockCtx.clearRect).toHaveBeenCalled();
    });

    it('draws selected driver trace using their team color', async () => {
        const location1: LocationPacket = { ...mockLocation, x: 100, y: 200 };
        const location2: LocationPacket = { ...mockLocation, x: 150, y: 250 };
        const queueRef = makeQueueRef([location1, location2]);

        render(<CircuitTrace locationQueueRef={queueRef} selectedDriver={mockDriver} sessionKey={SESSION_KEY} resetKey={0} {...defaultOverlayProps} />);

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('draws ghost traces for non-selected drivers', async () => {
        const otherDriverLocation: LocationPacket = {
            ...mockLocation, driver_number: 44, x: 300, y: 400
        };
        const otherDriverLocation2: LocationPacket = {
            ...mockLocation, driver_number: 44, x: 350, y: 450
        };
        const location2: LocationPacket = { ...mockLocation, x: 150, y: 250 };

        const queueRef = makeQueueRef([
            mockLocation, location2,
            otherDriverLocation, otherDriverLocation2
        ]);

        render(<CircuitTrace locationQueueRef={queueRef} selectedDriver={mockDriver} sessionKey={SESSION_KEY} resetKey={0} {...defaultOverlayProps} />);

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('shows "None" when no driver is selected', () => {
        const queueRef = makeQueueRef();
        render(<CircuitTrace locationQueueRef={queueRef} selectedDriver={null} sessionKey={null} resetKey={0} {...defaultOverlayProps} />);

        expect(screen.getByText(/None/)).toBeInTheDocument();
    });

    it('handles empty queue gracefully', async () => {
        const queueRef = makeQueueRef();
        render(<CircuitTrace locationQueueRef={queueRef} selectedDriver={mockDriver} sessionKey={SESSION_KEY} resetKey={0} {...defaultOverlayProps} />);

        expect(screen.getByText('CIRCUIT TRACE')).toBeInTheDocument();
        expect(screen.getByText(/VER/)).toBeInTheDocument();

        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockCtx.clearRect).toHaveBeenCalled();
    });

    it('renders idle overlay when no session is active', () => {
        const queueRef = makeQueueRef();
        render(
            <CircuitTrace
                locationQueueRef={queueRef}
                selectedDriver={null}
                sessionKey={null}
                resetKey={0}
                isSessionActive={false}
                isInitializing={false}
                sessionMeta={null}
                driverCode={null}
            />
        );

        expect(screen.getByTestId('idle-overlay')).toBeInTheDocument();
    });

    it('renders loading overlay when session is initializing', () => {
        const queueRef = makeQueueRef();
        render(
            <CircuitTrace
                locationQueueRef={queueRef}
                selectedDriver={mockDriver}
                sessionKey={SESSION_KEY}
                resetKey={0}
                isSessionActive={true}
                isInitializing={true}
                sessionMeta={{ year: 2024, meetingName: 'Bahrain Grand Prix' }}
                driverCode="VER"
            />
        );

        expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
        expect(screen.getByText(/2024 Bahrain Grand Prix VER/)).toBeInTheDocument();
    });

    it('renders no overlay when session is active and loaded', () => {
        const queueRef = makeQueueRef();
        render(
            <CircuitTrace
                locationQueueRef={queueRef}
                selectedDriver={mockDriver}
                sessionKey={SESSION_KEY}
                resetKey={0}
                isSessionActive={true}
                isInitializing={false}
                sessionMeta={{ year: 2024, meetingName: 'Bahrain Grand Prix' }}
                driverCode="VER"
            />
        );

        expect(screen.queryByTestId('idle-overlay')).not.toBeInTheDocument();
        expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    });

    it('displays race info text after successful load', () => {
        const queueRef = makeQueueRef();
        render(
            <CircuitTrace
                locationQueueRef={queueRef}
                selectedDriver={mockDriver}
                sessionKey={SESSION_KEY}
                resetKey={0}
                isSessionActive={true}
                isInitializing={false}
                sessionMeta={{ year: 2024, meetingName: 'Bahrain Grand Prix' }}
                driverCode="VER"
            />
        );

        expect(screen.getByText('2024 | BAHRAIN GRAND PRIX')).toBeInTheDocument();
    });
});
