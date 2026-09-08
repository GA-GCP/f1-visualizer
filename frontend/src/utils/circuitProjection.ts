export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * World-to-canvas mapping held as affine constants.
 *
 * The render loop used to build two `d3.scaleLinear` objects per frame and call
 * them through a closure for every point of every driver. The maths is a
 * multiply and an add, so it is computed once when the bounds change and the
 * constants reused — the output is identical to the d3 scales it replaces.
 */
export interface Projection {
    /** Multiply-add constants: canvasX = x * scaleX + offsetX. */
    readonly scaleX: number;
    readonly offsetX: number;
    /** Negative scaleY, because canvas y grows downward and world y grows up. */
    readonly scaleY: number;
    readonly offsetY: number;
}

export const CIRCUIT_ASPECT_RATIO = 1.6;
export const CIRCUIT_PADDING = 40;

/**
 * Computes the bounding box from a selected driver's position history.
 */
export function computeBounds(
    history: Record<number, { x: number; y: number }[]>,
    selectedDriverId: number | undefined,
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
 * Builds the world-to-canvas mapping for a set of bounds and a canvas size.
 *
 * Sizes are CSS pixels; the caller applies the devicePixelRatio transform.
 */
export function createProjection(
    bounds: Bounds,
    canvasWidth: number,
    canvasHeight: number,
    padding: number = CIRCUIT_PADDING,
): Projection {
    const { minX, minY } = bounds;
    // A single recorded point gives a zero-width domain; nudge it so the
    // division stays finite, matching the scales this replaced.
    const spanX = bounds.maxX - minX || 0.001;
    const spanY = bounds.maxY - minY || 0.001;

    const scaleX = (canvasWidth - 2 * padding) / spanX;
    const scaleY = -(canvasHeight - 2 * padding) / spanY;

    return {
        scaleX,
        offsetX: padding - minX * scaleX,
        scaleY,
        offsetY: canvasHeight - padding - minY * scaleY,
    };
}

/** Projects a world-space point to canvas pixels. */
export function projectPoint(
    x: number,
    y: number,
    projection: Projection,
): { sx: number; sy: number } {
    return {
        sx: x * projection.scaleX + projection.offsetX,
        sy: y * projection.scaleY + projection.offsetY,
    };
}

/**
 * Determines whether bounds are valid (i.e. at least one point has been recorded).
 */
export function areBoundsValid(bounds: Bounds): boolean {
    return bounds.minX !== Infinity && bounds.maxX !== -Infinity;
}
