import * as d3 from 'd3';

export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface Scales {
    xScale: d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
}

export const CIRCUIT_ASPECT_RATIO = 1.6;
export const CIRCUIT_PADDING = 40;

/**
 * Computes the bounding box from a selected driver's position history.
 */
export function computeBounds(
    history: Record<number, { x: number; y: number }[]>,
    selectedDriverId: number | undefined
): Bounds {
    const bounds: Bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    };

    if (selectedDriverId === undefined) return bounds;

    const driverHistory = history[selectedDriverId];
    if (!driverHistory) return bounds;

    for (const point of driverHistory) {
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxY = Math.max(bounds.maxY, point.y);
    }

    return bounds;
}

/**
 * Creates D3 linear scales that map world coordinates to canvas pixel space.
 */
export function createScales(
    bounds: Bounds,
    canvasWidth: number,
    canvasHeight: number,
    padding: number = CIRCUIT_PADDING
): Scales {
    const { minX, minY } = bounds;
    let { maxX, maxY } = bounds;

    // Prevent zero-range domains
    if (minX === maxX) maxX += 0.001;
    if (minY === maxY) maxY += 0.001;

    const xScale = d3.scaleLinear()
        .domain([minX, maxX])
        .range([padding, canvasWidth - padding]);

    const yScale = d3.scaleLinear()
        .domain([minY, maxY])
        .range([canvasHeight - padding, padding]);

    return { xScale, yScale };
}

/**
 * Projects a world-space (x, y) point to canvas pixel coordinates.
 */
export function projectPoint(
    x: number,
    y: number,
    scales: Scales
): { sx: number; sy: number } {
    return {
        sx: scales.xScale(x),
        sy: scales.yScale(y),
    };
}

/**
 * Determines whether bounds are valid (i.e. at least one point has been recorded).
 */
export function areBoundsValid(bounds: Bounds): boolean {
    return bounds.minX !== Infinity && bounds.maxX !== -Infinity;
}
