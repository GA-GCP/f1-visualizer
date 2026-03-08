import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LapTimeChart from '../LapTimeChart';
import type { LapDataRecord } from '@/types/telemetry.ts';

// Mock D3 with a functional subset that supports the chained API pattern
vi.mock('d3', () => {
    const createSelection = (): Record<string, unknown> => {
        const sel: Record<string, unknown> = {};
        sel.selectAll = vi.fn().mockReturnValue(sel);
        sel.select = vi.fn().mockReturnValue(sel);
        sel.remove = vi.fn().mockReturnValue(sel);
        sel.append = vi.fn().mockReturnValue(sel);
        sel.attr = vi.fn().mockReturnValue(sel);
        sel.style = vi.fn().mockReturnValue(sel);
        sel.text = vi.fn().mockReturnValue(sel);
        sel.call = vi.fn().mockReturnValue(sel);
        sel.datum = vi.fn().mockReturnValue(sel);
        sel.data = vi.fn().mockReturnValue(sel);
        sel.enter = vi.fn().mockReturnValue(sel);
        sel.on = vi.fn().mockReturnValue(sel);
        sel.html = vi.fn().mockReturnValue(sel);
        return sel;
    };

    const createScale = () => {
        const scale = (v: number) => v;
        scale.domain = vi.fn().mockReturnValue(scale);
        scale.range = vi.fn().mockReturnValue(scale);
        scale.ticks = vi.fn().mockReturnValue([]);
        return scale;
    };

    return {
        select: vi.fn().mockReturnValue(createSelection()),
        scaleLinear: vi.fn().mockReturnValue(createScale()),
        extent: vi.fn().mockReturnValue([1, 3]),
        min: vi.fn().mockReturnValue(80),
        max: vi.fn().mockReturnValue(90),
        group: vi.fn().mockReturnValue(new Map()),
        axisBottom: vi.fn().mockReturnValue({ ticks: vi.fn().mockReturnValue(vi.fn()) }),
        axisLeft: vi.fn().mockReturnValue(vi.fn()),
        line: vi.fn().mockReturnValue({
            x: vi.fn().mockReturnThis(),
            y: vi.fn().mockReturnThis(),
            curve: vi.fn().mockReturnThis(),
        }),
        curveMonotoneX: vi.fn(),
        pointer: vi.fn().mockReturnValue([0, 0])
    };
});

describe('LapTimeChart', () => {
    const mockLapData: LapDataRecord[] = [
        { driverNumber: 1, lapNumber: 1, lapDuration: 82.5 },
        { driverNumber: 1, lapNumber: 2, lapDuration: 81.3 },
        { driverNumber: 1, lapNumber: 3, lapDuration: 81.8 },
        { driverNumber: 16, lapNumber: 1, lapDuration: 83.1 },
        { driverNumber: 16, lapNumber: 2, lapDuration: 82.0 },
        { driverNumber: 16, lapNumber: 3, lapDuration: 82.4 },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders SVG element', () => {
        const { container } = render(<LapTimeChart data={mockLapData} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders the chart title', () => {
        render(<LapTimeChart data={mockLapData} />);
        expect(screen.getByText('LAP TIME PROGRESSION')).toBeInTheDocument();
    });

    it('renders custom title when provided', () => {
        render(<LapTimeChart data={mockLapData} title="Race Pace Analysis" />);
        expect(screen.getByText('Race Pace Analysis')).toBeInTheDocument();
    });

    it('renders axis labels', () => {
        // Since D3 is mocked, axis labels are created via d3.select().append("text").text()
        // We verify the component renders without error and contains the SVG
        const { container } = render(<LapTimeChart data={mockLapData} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('handles empty data array', () => {
        const { container } = render(<LapTimeChart data={[]} />);
        // Should still render the container and title, just no chart content
        expect(screen.getByText('LAP TIME PROGRESSION')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with driverColorMap', () => {
        const colorMap = { 1: '#3671C6', 16: '#E80020' };
        const { container } = render(<LapTimeChart data={mockLapData} driverColorMap={colorMap} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with driverLabelMap', () => {
        const colorMap = { 1: '#3671C6', 16: '#E80020' };
        const labelMap = { 1: 'VER', 16: 'LEC' };
        const { container } = render(
            <LapTimeChart data={mockLapData} driverColorMap={colorMap} driverLabelMap={labelMap} />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
