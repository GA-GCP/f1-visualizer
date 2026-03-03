import * as d3 from 'd3';

export const RADAR_FEATURES = ['speed', 'consistency', 'aggression', 'tireMgmt', 'experience'] as const;
export type RadarFeature = typeof RADAR_FEATURES[number];

export interface RadarPoint {
    x: number;
    y: number;
}

/**
 * Computes the angle (in radians) for a given axis index on the radar chart.
 * Axes are evenly distributed around the circle, starting from 12-o'clock.
 */
export function angleForAxis(index: number, total: number = RADAR_FEATURES.length): number {
    return (Math.PI * 2 / total) * index - Math.PI / 2;
}

/**
 * Computes the radar polygon coordinates for a driver's stats,
 * given a scale that maps [0, 100] → [0, radius].
 */
export function computeRadarPoints(
    stats: Record<string, number>,
    rScale: d3.ScaleLinear<number, number>
): RadarPoint[] {
    const points = RADAR_FEATURES.map((feature, i) => {
        const value = stats[feature] ?? 0;
        const angle = angleForAxis(i);
        return {
            x: rScale(value) * Math.cos(angle),
            y: rScale(value) * Math.sin(angle),
        };
    });

    // Close the polygon by repeating the first point
    points.push(points[0]);
    return points;
}

/**
 * Creates the radial scale for the radar chart.
 */
export function createRadialScale(radius: number): d3.ScaleLinear<number, number> {
    return d3.scaleLinear().range([0, radius]).domain([0, 100]);
}
