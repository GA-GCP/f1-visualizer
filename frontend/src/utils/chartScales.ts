import * as d3 from 'd3';
import type { LapDataRecord } from '../types/telemetry';
import type { SessionDriverEntry } from '../api/referenceApi';

export const LAP_CHART_ASPECT_RATIO = 2;
export const LAP_CHART_MARGIN = { top: 20, right: 120, bottom: 50, left: 60 };
export const FALLBACK_COLORS = [
    '#e10600', '#00D2BE', '#0600EF', '#FF8700', '#006F62',
    '#2B4562', '#B6BABD', '#C92D4B', '#5E8FAA', '#27F4D2'
];

/**
 * Resolves the display color for a given driver number, using the
 * team color map with a fallback to a static palette.
 * Color map values must include the '#' prefix.
 */
export function getDriverColor(
    driverNum: number,
    index: number,
    driverColorMap?: Record<number, string>
): string {
    if (driverColorMap?.[driverNum]) return driverColorMap[driverNum];
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * Builds a per-driver color map from a session roster, differentiating
 * teammates by lightening the second driver's color via HSL adjustment.
 * Returns colors with '#' prefix included.
 */
export function buildDriverColorMap(
    drivers: SessionDriverEntry[]
): Record<number, string> {
    const colorMap: Record<number, string> = {};

    // Group drivers by team
    const teamGroups = new Map<string, SessionDriverEntry[]>();
    for (const d of drivers) {
        const team = d.teamName || 'Unknown';
        if (!teamGroups.has(team)) teamGroups.set(team, []);
        teamGroups.get(team)!.push(d);
    }

    for (const teammates of teamGroups.values()) {
        const rawHex = '#' + (teammates[0].teamColour || 'ffffff');
        const baseHex = d3.color(rawHex)?.formatHex() ?? rawHex;
        colorMap[teammates[0].driverNumber] = baseHex;

        if (teammates.length > 1) {
            const hsl = d3.hsl(baseHex);
            hsl.l = Math.min(hsl.l + 0.25, 0.85);
            colorMap[teammates[1].driverNumber] = hsl.formatHex();
        }

        // Mid-season replacement edge case: 3+ drivers on a team
        for (let i = 2; i < teammates.length; i++) {
            const hsl = d3.hsl('#' + (teammates[i].teamColour || 'ffffff'));
            hsl.l = Math.min(hsl.l + 0.15 * i, 0.90);
            colorMap[teammates[i].driverNumber] = hsl.formatHex();
        }
    }

    return colorMap;
}

/**
 * Builds a driver-number-to-label map from the roster using nameAcronym.
 */
export function buildDriverLabelMap(
    drivers: SessionDriverEntry[]
): Record<number, string> {
    const labelMap: Record<number, string> = {};
    for (const d of drivers) {
        labelMap[d.driverNumber] = d.nameAcronym || String(d.driverNumber);
    }
    return labelMap;
}

/**
 * Computes the inner (chart area) dimensions after subtracting margins.
 */
export function computeInnerDimensions(width: number) {
    const height = Math.round(width / LAP_CHART_ASPECT_RATIO);
    return {
        width,
        height,
        innerWidth: width - LAP_CHART_MARGIN.left - LAP_CHART_MARGIN.right,
        innerHeight: height - LAP_CHART_MARGIN.top - LAP_CHART_MARGIN.bottom,
    };
}

/**
 * Creates X and Y scales for a lap time chart from the provided data.
 */
export function createLapChartScales(
    data: LapDataRecord[],
    innerWidth: number,
    innerHeight: number
) {
    const xDomain = d3.extent(data, d => d.lapNumber) as [number, number];
    const validDurations = data.filter(d => d.lapDuration).map(d => d.lapDuration!);
    const yMin = d3.min(validDurations)! - 2;
    const yMax = d3.max(validDurations)! + 2;

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    return { xScale, yScale };
}

/**
 * Groups lap data records by driver number.
 */
export function groupByDriver(data: LapDataRecord[]) {
    return d3.group(data.filter(d => d.lapDuration), d => d.driverNumber);
}
