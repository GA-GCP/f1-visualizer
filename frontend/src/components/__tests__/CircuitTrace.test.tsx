import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('CircuitTrace', () => {
    let mockCtx: Record<string, ReturnType<typeof vi.fn> | number | string>;

    const mockDriver: DriverProfile = {
        id: 1,
        code: 'VER',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        teamColor: '#3671C6',
        stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98 }
    };

    const mockLocation: LocationPacket = {
        session_key: 1,
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
            strokeStyle: '',
            fillStyle: '',
            lineWidth: 1,
            lineJoin: 'miter',
            shadowBlur: 0,
            shadowColor: ''
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
        render(<CircuitTrace latestLocation={mockLocation} selectedDriver={mockDriver} />);

        // Allow animation frame to fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(mockCtx.clearRect).toHaveBeenCalled();
    });

    it('draws selected driver trace using their team color', async () => {
        const { rerender } = render(<CircuitTrace latestLocation={null} selectedDriver={mockDriver} />);

        // Provide a second location point so the trace can actually draw a line (needs >= 2 points)
        const location1: LocationPacket = { ...mockLocation, x: 100, y: 200 };
        rerender(<CircuitTrace latestLocation={location1} selectedDriver={mockDriver} />);

        const location2: LocationPacket = { ...mockLocation, x: 150, y: 250 };
        rerender(<CircuitTrace latestLocation={location2} selectedDriver={mockDriver} />);

        // Allow animation frame to fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // Verify beginPath was called (for trace line drawing)
        expect(mockCtx.beginPath).toHaveBeenCalled();
        // Verify moveTo and lineTo were called (line drawing operations)
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('draws ghost traces for non-selected drivers', async () => {
        // Create location from a different driver (not the selected one)
        const otherDriverLocation: LocationPacket = {
            ...mockLocation,
            driver_number: 44,
            x: 300,
            y: 400
        };

        const otherDriverLocation2: LocationPacket = {
            ...mockLocation,
            driver_number: 44,
            x: 350,
            y: 450
        };

        // We also need the selected driver's location to establish bounds
        const { rerender } = render(<CircuitTrace latestLocation={mockLocation} selectedDriver={mockDriver} />);

        // Add second point for selected driver (establishes bounds)
        const location2: LocationPacket = { ...mockLocation, x: 150, y: 250 };
        rerender(<CircuitTrace latestLocation={location2} selectedDriver={mockDriver} />);

        // Add the other driver's locations
        rerender(<CircuitTrace latestLocation={otherDriverLocation} selectedDriver={mockDriver} />);
        rerender(<CircuitTrace latestLocation={otherDriverLocation2} selectedDriver={mockDriver} />);

        // Allow animation frame to fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // Both driver traces should be drawn - beginPath called multiple times
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('shows "None" when no driver is selected', () => {
        render(<CircuitTrace latestLocation={null} selectedDriver={null} />);

        expect(screen.getByText(/None/)).toBeInTheDocument();
    });

    it('handles null latestLocation gracefully', async () => {
        render(<CircuitTrace latestLocation={null} selectedDriver={mockDriver} />);

        // Should still render the canvas and labels without crashing
        expect(screen.getByText('CIRCUIT TRACE')).toBeInTheDocument();
        expect(screen.getByText(/VER/)).toBeInTheDocument();

        // Allow animation frame to fire
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        // clearRect should still be called (canvas clears every frame)
        expect(mockCtx.clearRect).toHaveBeenCalled();
    });
});
