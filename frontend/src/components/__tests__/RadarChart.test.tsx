import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RadarChart from '../versus/RadarChart';
import type { DriverProfile } from '@/api/referenceApi.ts';

// Track calls to text() to verify axis labels, style() for colors, datum() for data paths
const textCalls: string[] = [];
const styleCalls: Array<{ prop: string; value: string }> = [];
let datumCallCount = 0;
let appendCallCount = 0;

vi.mock('d3', () => {
    const createSelection = (): Record<string, unknown> => {
        const sel: Record<string, unknown> = {};
        sel.selectAll = vi.fn().mockReturnValue(sel);
        sel.select = vi.fn().mockReturnValue(sel);
        sel.remove = vi.fn().mockReturnValue(sel);
        sel.append = vi.fn().mockImplementation(() => {
            appendCallCount++;
            return sel;
        });
        sel.attr = vi.fn().mockReturnValue(sel);
        sel.style = vi.fn().mockImplementation((prop: string, value: string) => {
            if (prop && value !== undefined) {
                styleCalls.push({ prop, value });
            }
            return sel;
        });
        sel.text = vi.fn().mockImplementation((t: string | ((d: string) => string)) => {
            if (typeof t === 'function') {
                // Simulate D3 calling the function for each feature label
                const features = ['speed', 'consistency', 'aggression', 'tireMgmt', 'experience'];
                features.forEach(f => textCalls.push(t(f)));
            } else if (t !== undefined) {
                textCalls.push(t);
            }
            return sel;
        });
        sel.data = vi.fn().mockReturnValue(sel);
        sel.enter = vi.fn().mockReturnValue(sel);
        sel.datum = vi.fn().mockImplementation(() => {
            datumCallCount++;
            return sel;
        });
        return sel;
    };

    const createScale = () => {
        const scale = (v: number) => v;
        scale.domain = vi.fn().mockReturnValue(scale);
        scale.range = vi.fn().mockReturnValue(scale);
        return scale;
    };

    return {
        select: vi.fn().mockReturnValue(createSelection()),
        scaleLinear: vi.fn().mockReturnValue(createScale()),
        line: vi.fn().mockReturnValue({
            x: vi.fn().mockReturnThis(),
            y: vi.fn().mockReturnThis()
        })
    };
});

describe('RadarChart', () => {
    const mockDriverA: DriverProfile = {
        id: 1,
        code: 'VER',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        teamColor: '#3671C6',
        stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98, totalPoints: 2586, bestChampionshipFinish: 1, totalRaces: 185, teamsDrivenFor: ['Red Bull Racing'] }
    };

    const mockDriverB: DriverProfile = {
        id: 16,
        code: 'LEC',
        name: 'Charles Leclerc',
        team: 'Ferrari',
        teamColor: '#E80020',
        stats: { speed: 96, consistency: 88, aggression: 90, tireMgmt: 85, experience: 80, wins: 5, podiums: 30, totalPoints: 1200, bestChampionshipFinish: 2, totalRaces: 130, teamsDrivenFor: ['Ferrari', 'Sauber'] }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        textCalls.length = 0;
        styleCalls.length = 0;
        datumCallCount = 0;
        appendCallCount = 0;
    });

    it('renders SVG element', () => {
        const { container } = render(<RadarChart driverA={mockDriverA} driverB={mockDriverB} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders axis labels (SPEED, CONSISTENCY, AGGRESSION, TIREMGMT, EXPERIENCE)', () => {
        render(<RadarChart driverA={mockDriverA} driverB={mockDriverB} />);

        expect(textCalls).toContain('SPEED');
        expect(textCalls).toContain('CONSISTENCY');
        expect(textCalls).toContain('AGGRESSION');
        expect(textCalls).toContain('TIREMGMT');
        expect(textCalls).toContain('EXPERIENCE');
    });

    it('renders two driver data paths', () => {
        render(<RadarChart driverA={mockDriverA} driverB={mockDriverB} />);

        // The component calls svg.append("path").datum(coordinates) twice (once per driver)
        // Verify datum was called at least twice (once for each driver's data polygon)
        expect(datumCallCount).toBeGreaterThanOrEqual(2);
        // Verify append was called (for "g", axis lines/text, and two "path" elements)
        expect(appendCallCount).toBeGreaterThan(2);
    });

    it('applies driver team colors', () => {
        render(<RadarChart driverA={mockDriverA} driverB={mockDriverB} />);

        // The component sets style("stroke", driver.teamColor) and style("fill", driver.teamColor)
        const strokeCalls = styleCalls.filter(c => c.prop === 'stroke');
        const fillCalls = styleCalls.filter(c => c.prop === 'fill');

        // Both driver colors should appear in stroke calls
        const strokeValues = strokeCalls.map(c => c.value);
        expect(strokeValues).toContain('#3671C6');
        expect(strokeValues).toContain('#E80020');

        // Both driver colors should appear in fill calls
        const fillValues = fillCalls.map(c => c.value);
        expect(fillValues).toContain('#3671C6');
        expect(fillValues).toContain('#E80020');
    });
});
