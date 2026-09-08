import { describe, it, expect } from 'vitest';
import {
    computeBounds,
    createProjection,
    projectPoint,
    areBoundsValid,
    CIRCUIT_PADDING,
    type Bounds,
} from '../circuitProjection';

describe('computeBounds', () => {
    it('returns Infinity bounds when history is empty', () => {
        const bounds = computeBounds({}, 1);
        expect(bounds.minX).toBe(Infinity);
        expect(bounds.maxX).toBe(-Infinity);
        expect(bounds.minY).toBe(Infinity);
        expect(bounds.maxY).toBe(-Infinity);
    });

    it('returns Infinity bounds when selectedDriverId is undefined', () => {
        const history = { 1: [{ x: 10, y: 20 }] };
        const bounds = computeBounds(history, undefined);
        expect(bounds.minX).toBe(Infinity);
        expect(bounds.maxX).toBe(-Infinity);
    });

    it('returns correct bounds for a single point', () => {
        const history = { 1: [{ x: 5, y: 10 }] };
        const bounds = computeBounds(history, 1);
        expect(bounds.minX).toBe(5);
        expect(bounds.maxX).toBe(5);
        expect(bounds.minY).toBe(10);
        expect(bounds.maxY).toBe(10);
    });

    it('returns correct bounds for multiple points', () => {
        const history = {
            1: [
                { x: 0, y: 0 },
                { x: 100, y: 200 },
                { x: -50, y: 50 },
            ],
        };
        const bounds = computeBounds(history, 1);
        expect(bounds.minX).toBe(-50);
        expect(bounds.maxX).toBe(100);
        expect(bounds.minY).toBe(0);
        expect(bounds.maxY).toBe(200);
    });

    it('only uses the selected driver, ignoring others', () => {
        const history = {
            1: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            2: [
                { x: -999, y: -999 },
                { x: 999, y: 999 },
            ],
        };
        const bounds = computeBounds(history, 1);
        expect(bounds.minX).toBe(0);
        expect(bounds.maxX).toBe(10);
        expect(bounds.minY).toBe(0);
        expect(bounds.maxY).toBe(10);
    });

    it('returns Infinity bounds when selected driver has no history entry', () => {
        const history = { 1: [{ x: 5, y: 5 }] };
        const bounds = computeBounds(history, 99);
        expect(bounds.minX).toBe(Infinity);
        expect(bounds.maxX).toBe(-Infinity);
    });
});

describe('createProjection', () => {
    it('maps domain boundaries to the padded canvas edges', () => {
        const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
        const canvasWidth = 400;
        const canvasHeight = 300;

        const projection = createProjection(bounds, canvasWidth, canvasHeight);

        // x: [minX, maxX] -> [padding, width - padding]
        expect(projectPoint(0, 0, projection).sx).toBeCloseTo(CIRCUIT_PADDING);
        expect(projectPoint(100, 0, projection).sx).toBeCloseTo(canvasWidth - CIRCUIT_PADDING);
        // y is flipped: the domain minimum sits at the bottom of the canvas.
        expect(projectPoint(0, 0, projection).sy).toBeCloseTo(canvasHeight - CIRCUIT_PADDING);
        expect(projectPoint(0, 50, projection).sy).toBeCloseTo(CIRCUIT_PADDING);
    });

    it('stays finite when a single point gives a zero-width domain', () => {
        const bounds = { minX: 10, maxX: 10, minY: 0, maxY: 100 };

        const projection = createProjection(bounds, 400, 300);

        expect(Number.isFinite(projectPoint(10, 0, projection).sx)).toBe(true);
    });

    it('stays finite when a single point gives a zero-height domain', () => {
        const bounds = { minX: 0, maxX: 100, minY: 5, maxY: 5 };

        const projection = createProjection(bounds, 400, 300);

        expect(Number.isFinite(projectPoint(0, 5, projection).sy)).toBe(true);
    });

    it('respects a custom padding value', () => {
        const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
        const customPadding = 10;

        const projection = createProjection(bounds, 200, 200, customPadding);

        expect(projectPoint(0, 0, projection).sx).toBeCloseTo(customPadding);
        expect(projectPoint(10, 0, projection).sx).toBeCloseTo(200 - customPadding);
    });

    it('is a pure affine mapping, so it can be reused across frames', () => {
        // The point of replacing the d3 scales: no per-frame allocation, and the
        // same constants give the same answer every time.
        const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const projection = createProjection(bounds, 500, 500, 0);

        const midpoint = projectPoint(50, 50, projection);
        expect(projectPoint(50, 50, projection)).toEqual(midpoint);
        // Linear: doubling the distance from the origin doubles the offset.
        expect(projectPoint(100, 0, projection).sx - projectPoint(0, 0, projection).sx).toBeCloseTo(
            2 * (projectPoint(50, 0, projection).sx - projectPoint(0, 0, projection).sx),
        );
    });
});

describe('projectPoint', () => {
    it('maps a world-space point to pixel coordinates', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const projection = createProjection(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(50, 50, projection);
        expect(sx).toBeCloseTo(250);
        expect(sy).toBeCloseTo(250);
    });

    it('maps the domain origin to the range start', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const projection = createProjection(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(0, 0, projection);
        expect(sx).toBeCloseTo(0);
        expect(sy).toBeCloseTo(500); // y is inverted
    });

    it('maps the domain maximum to the range end', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const projection = createProjection(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(100, 100, projection);
        expect(sx).toBeCloseTo(500);
        expect(sy).toBeCloseTo(0); // y is inverted
    });
});

describe('areBoundsValid', () => {
    it('returns false for initial Infinity bounds', () => {
        const bounds: Bounds = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
        };
        expect(areBoundsValid(bounds)).toBe(false);
    });

    it('returns true for valid finite bounds', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 200 };
        expect(areBoundsValid(bounds)).toBe(true);
    });

    it('returns true for zero-area bounds (single point)', () => {
        const bounds: Bounds = { minX: 5, maxX: 5, minY: 5, maxY: 5 };
        expect(areBoundsValid(bounds)).toBe(true);
    });
});
