import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LiveTelemetryPanel from '../LiveTelemetryPanel';
import type { DriverProfile } from '../../../api/referenceApi';
import type { TelemetryPacket, LapDataRecord } from '../../../types/telemetry';

let emit: (packet: TelemetryPacket) => void = () => {};
let connected = true;
vi.mock('../../../hooks/useTelemetry', () => ({
    useTelemetry: (cb: (packet: TelemetryPacket) => void) => {
        emit = cb;
        return { isConnected: connected };
    },
}));

const driver = { id: 1, code: 'VER', teamColor: '#123456' } as DriverProfile;
const session = { key: 500, mode: 'SIMULATION' };

const packet = (over: Partial<TelemetryPacket> = {}): TelemetryPacket => ({
    session_key: 500,
    meeting_key: 1,
    date: '2024-05-01T12:01:30Z',
    driver_number: 1,
    speed: 300,
    rpm: 11000,
    gear: 7,
    throttle: 100,
    brake: 0,
    drs: 0,
    ...over,
});

const laps: LapDataRecord[] = [
    { driverNumber: 1, lapNumber: 1, dateStart: '2024-05-01T12:00:00Z', compound: 'SOFT' },
    { driverNumber: 1, lapNumber: 2, dateStart: '2024-05-01T12:01:00Z', compound: 'MEDIUM' },
];

/** Reads a metric by its <dt> label, so values are never confused with each other. */
const metric = (label: string) => screen.getByText(label).nextElementSibling?.textContent ?? '';

const renderPanel = (over: Partial<React.ComponentProps<typeof LiveTelemetryPanel>> = {}) =>
    render(
        <LiveTelemetryPanel
            selectedDriver={driver}
            activeSession={session}
            sessionLaps={laps}
            resetKey={0}
            onFirstPacket={vi.fn()}
            {...over}
        />,
    );

describe('LiveTelemetryPanel', () => {
    let now = 0;

    beforeEach(() => {
        now = 10_000;
        connected = true;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prompts for a session before anything is running', () => {
        renderPanel({ activeSession: null });

        expect(screen.getByText(/initialize a session to begin/i)).toBeInTheDocument();
    });

    it('names the driver it is waiting on', () => {
        renderPanel();

        expect(screen.getByText(/waiting for data from VER/i)).toBeInTheDocument();
    });

    it('renders the readout when a packet for the selected driver arrives', () => {
        renderPanel();

        act(() => emit(packet()));

        expect(screen.getByText('300')).toBeInTheDocument();
        expect(metric('RPM')).toBe('11000');
        expect(metric('GEAR')).toBe('7');
    });

    it('ignores packets for other drivers and other sessions', () => {
        renderPanel();

        act(() => emit(packet({ driver_number: 44, speed: 111 })));
        act(() => emit(packet({ session_key: 999, speed: 222 })));

        expect(screen.queryByText('111')).not.toBeInTheDocument();
        expect(screen.queryByText('222')).not.toBeInTheDocument();
        expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
    });

    it('commits at about 10 Hz rather than on every frame', () => {
        renderPanel();

        act(() => emit(packet({ speed: 300 })));
        expect(screen.getByText('300')).toBeInTheDocument();

        // Same frame budget: a person cannot read this fast, and re-rendering
        // here used to reconcile the whole dashboard.
        now += 20;
        act(() => emit(packet({ speed: 301 })));
        expect(screen.queryByText('301')).not.toBeInTheDocument();
        expect(screen.getByText('300')).toBeInTheDocument();

        now += 120;
        act(() => emit(packet({ speed: 302 })));
        expect(screen.getByText('302')).toBeInTheDocument();
    });

    it('commits a gear change immediately, without waiting for the interval', () => {
        renderPanel();

        act(() => emit(packet({ gear: 7 })));
        now += 10;
        act(() => emit(packet({ gear: 6, speed: 280 })));

        expect(metric('GEAR')).toBe('6');
        expect(screen.getByText('280')).toBeInTheDocument();
    });

    it('commits the brake going on immediately', () => {
        renderPanel();

        act(() => emit(packet({ brake: 0, throttle: 100 })));
        expect(metric('BRAKE')).toBe('0%');

        now += 10;
        act(() => emit(packet({ brake: 90, throttle: 0, speed: 250 })));

        expect(metric('BRAKE')).toBe('90%');
        expect(metric('THROTTLE')).toBe('0%');
    });

    it('correlates the lap from the packet timestamp', () => {
        renderPanel();

        act(() => emit(packet({ date: '2024-05-01T12:01:30Z' })));

        expect(screen.getByText(/LAP 2/)).toBeInTheDocument();
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
        // Lap 1 was SOFT, so the compound change is shown.
        expect(screen.getByText('SOFT → MEDIUM')).toBeInTheDocument();
    });

    it('announces the first packet once per reset, not once per packet', () => {
        const onFirstPacket = vi.fn();
        renderPanel({ onFirstPacket });

        act(() => emit(packet()));
        now += 200;
        act(() => emit(packet({ speed: 305 })));

        expect(onFirstPacket).toHaveBeenCalledTimes(1);
    });

    it('clears the readout when the reset key changes', () => {
        const { rerender } = renderPanel();

        act(() => emit(packet({ speed: 300 })));
        expect(screen.getByText('300')).toBeInTheDocument();

        rerender(
            <LiveTelemetryPanel
                selectedDriver={driver}
                activeSession={session}
                sessionLaps={laps}
                resetKey={1}
                onFirstPacket={vi.fn()}
            />,
        );

        expect(screen.queryByText('300')).not.toBeInTheDocument();
        expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
    });
});
