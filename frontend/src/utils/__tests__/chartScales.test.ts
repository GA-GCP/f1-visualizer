import { describe, it, expect } from 'vitest';
import {
    getDriverColor,
    computeInnerDimensions,
    createLapChartScales,
    groupByDriver,
    buildDriverColorMap,
    buildDriverLabelMap,
    FALLBACK_COLORS,
    LAP_CHART_ASPECT_RATIO,
    LAP_CHART_MARGIN,
} from '../chartScales';
import type { LapDataRecord } from '../../types/telemetry';
import type { SessionDriverEntry } from '../../api/referenceApi';

describe('getDriverColor', () => {
    it('returns the color from the map when present', () => {
        const colorMap = { 44: '#FF0000', 1: '#00FF00' };
        expect(getDriverColor(44, 0, colorMap)).toBe('#FF0000');
        expect(getDriverColor(1, 1, colorMap)).toBe('#00FF00');
    });

    it('falls back to FALLBACK_COLORS when driver is not in the map', () => {
        const colorMap = { 44: '#FF0000' };
        expect(getDriverColor(99, 2, colorMap)).toBe(FALLBACK_COLORS[2]);
    });

    it('falls back to FALLBACK_COLORS when no map is provided', () => {
        expect(getDriverColor(1, 0)).toBe(FALLBACK_COLORS[0]);
        expect(getDriverColor(1, 3)).toBe(FALLBACK_COLORS[3]);
    });

    it('wraps around the FALLBACK_COLORS array using modulo', () => {
        const len = FALLBACK_COLORS.length;
        expect(getDriverColor(1, len)).toBe(FALLBACK_COLORS[0]);
        expect(getDriverColor(1, len + 3)).toBe(FALLBACK_COLORS[3]);
    });
});

describe('buildDriverColorMap', () => {
    const makeDriver = (overrides: Partial<SessionDriverEntry>): SessionDriverEntry => ({
        driverNumber: 1,
        broadcastName: 'TEST',
        nameAcronym: 'TST',
        teamName: 'Test Team',
        teamColour: 'ffffff',
        countryCode: 'TST',
        ...overrides,
    });

    it('assigns base team color to first teammate and lighter variant to second', () => {
        const drivers = [
            makeDriver({ driverNumber: 44, nameAcronym: 'HAM', teamName: 'Mercedes', teamColour: '00D2BE' }),
            makeDriver({ driverNumber: 63, nameAcronym: 'RUS', teamName: 'Mercedes', teamColour: '00D2BE' }),
        ];
        const map = buildDriverColorMap(drivers);

        expect(map[44]).toBe('#00d2be');
        expect(map[63]).not.toBe('#00d2be');
        expect(map[63]).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('assigns unique colors to drivers on different teams', () => {
        const drivers = [
            makeDriver({ driverNumber: 44, teamName: 'Mercedes', teamColour: '00D2BE' }),
            makeDriver({ driverNumber: 1, teamName: 'Red Bull', teamColour: '3671C6' }),
        ];
        const map = buildDriverColorMap(drivers);

        expect(map[44]).toBe('#00d2be');
        expect(map[1]).toBe('#3671c6');
    });

    it('falls back to white for missing teamColour', () => {
        const drivers = [
            makeDriver({ driverNumber: 44, teamColour: '' }),
        ];
        const map = buildDriverColorMap(drivers);
        expect(map[44]).toBe('#ffffff');
    });

    it('handles empty roster', () => {
        expect(buildDriverColorMap([])).toEqual({});
    });
});

describe('buildDriverLabelMap', () => {
    const makeDriver = (overrides: Partial<SessionDriverEntry>): SessionDriverEntry => ({
        driverNumber: 1,
        broadcastName: 'TEST',
        nameAcronym: 'TST',
        teamName: 'Test Team',
        teamColour: 'ffffff',
        countryCode: 'TST',
        ...overrides,
    });

    it('maps driver numbers to name acronyms', () => {
        const drivers = [
            makeDriver({ driverNumber: 44, nameAcronym: 'HAM' }),
            makeDriver({ driverNumber: 63, nameAcronym: 'RUS' }),
        ];
        const map = buildDriverLabelMap(drivers);
        expect(map[44]).toBe('HAM');
        expect(map[63]).toBe('RUS');
    });

    it('falls back to driver number string when nameAcronym is empty', () => {
        const drivers = [
            makeDriver({ driverNumber: 44, nameAcronym: '' }),
        ];
        const map = buildDriverLabelMap(drivers);
        expect(map[44]).toBe('44');
    });

    it('handles empty roster', () => {
        expect(buildDriverLabelMap([])).toEqual({});
    });
});

describe('computeInnerDimensions', () => {
    it('computes height from width using the aspect ratio', () => {
        const width = 1000;
        const result = computeInnerDimensions(width);
        expect(result.width).toBe(width);
        expect(result.height).toBe(Math.round(width / LAP_CHART_ASPECT_RATIO));
    });

    it('subtracts margins to produce innerWidth and innerHeight', () => {
        const width = 800;
        const result = computeInnerDimensions(width);
        expect(result.innerWidth).toBe(width - LAP_CHART_MARGIN.left - LAP_CHART_MARGIN.right);
        expect(result.innerHeight).toBe(
            result.height - LAP_CHART_MARGIN.top - LAP_CHART_MARGIN.bottom
        );
    });

    it('rounds the height to an integer', () => {
        // 999 / 2 = 499.5, should round to 500
        const result = computeInnerDimensions(999);
        expect(result.height).toBe(Math.round(999 / LAP_CHART_ASPECT_RATIO));
        expect(Number.isInteger(result.height)).toBe(true);
    });
});

describe('createLapChartScales', () => {
    const sampleData: LapDataRecord[] = [
        { driverNumber: 1, lapNumber: 1, lapDuration: 90 },
        { driverNumber: 1, lapNumber: 2, lapDuration: 88 },
        { driverNumber: 1, lapNumber: 3, lapDuration: 92 },
        { driverNumber: 44, lapNumber: 1, lapDuration: 89 },
        { driverNumber: 44, lapNumber: 2, lapDuration: 87 },
        { driverNumber: 44, lapNumber: 3, lapDuration: 91 },
    ];

    it('creates xScale with domain from lapNumber extent', () => {
        const innerWidth = 600;
        const innerHeight = 300;
        const { xScale } = createLapChartScales(sampleData, innerWidth, innerHeight);

        expect(xScale(1)).toBeCloseTo(0);
        expect(xScale(3)).toBeCloseTo(innerWidth);
    });

    it('creates yScale with domain from lapDuration min-2 to max+2', () => {
        const innerWidth = 600;
        const innerHeight = 300;
        const { yScale } = createLapChartScales(sampleData, innerWidth, innerHeight);

        // min lapDuration = 87, max = 92, so domain = [85, 94]
        // yScale maps [85, 94] -> [innerHeight, 0]
        expect(yScale(85)).toBeCloseTo(innerHeight);
        expect(yScale(94)).toBeCloseTo(0);
    });

    it('filters out records without lapDuration for yScale domain', () => {
        const dataWithMissing: LapDataRecord[] = [
            { driverNumber: 1, lapNumber: 1, lapDuration: 80 },
            { driverNumber: 1, lapNumber: 2 }, // no lapDuration
            { driverNumber: 1, lapNumber: 3, lapDuration: 90 },
        ];
        const { yScale } = createLapChartScales(dataWithMissing, 600, 300);

        // min = 80, max = 90, domain = [78, 92]
        expect(yScale(78)).toBeCloseTo(300);
        expect(yScale(92)).toBeCloseTo(0);
    });
});

describe('groupByDriver', () => {
    it('groups records by driver number', () => {
        const data: LapDataRecord[] = [
            { driverNumber: 1, lapNumber: 1, lapDuration: 90 },
            { driverNumber: 44, lapNumber: 1, lapDuration: 89 },
            { driverNumber: 1, lapNumber: 2, lapDuration: 88 },
        ];
        const grouped = groupByDriver(data);

        expect(grouped.get(1)).toHaveLength(2);
        expect(grouped.get(44)).toHaveLength(1);
    });

    it('filters out records without lapDuration', () => {
        const data: LapDataRecord[] = [
            { driverNumber: 1, lapNumber: 1, lapDuration: 90 },
            { driverNumber: 1, lapNumber: 2 }, // no lapDuration
            { driverNumber: 1, lapNumber: 3, lapDuration: 88 },
        ];
        const grouped = groupByDriver(data);

        expect(grouped.get(1)).toHaveLength(2);
    });

    it('returns an empty map for empty input', () => {
        const grouped = groupByDriver([]);
        expect(grouped.size).toBe(0);
    });

    it('returns an empty map when no records have lapDuration', () => {
        const data: LapDataRecord[] = [
            { driverNumber: 1, lapNumber: 1 },
            { driverNumber: 44, lapNumber: 2 },
        ];
        const grouped = groupByDriver(data);
        expect(grouped.size).toBe(0);
    });
});
