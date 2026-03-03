import { describe, it, expect } from 'vitest';
import {
    computeBounds,
    createScales,
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
            1: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
            2: [{ x: -999, y: -999 }, { x: 999, y: 999 }],
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

describe('createScales', () => {
    it('maps domain boundaries to the correct range', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 200 };
        const canvasWidth = 800;
        const canvasHeight = 600;
        const padding = CIRCUIT_PADDING;

        const { xScale, yScale } = createScales(bounds, canvasWidth, canvasHeight);

        // minX -> padding, maxX -> canvasWidth - padding
        expect(xScale(0)).toBeCloseTo(padding);
        expect(xScale(100)).toBeCloseTo(canvasWidth - padding);

        // yScale is inverted: minY -> canvasHeight - padding, maxY -> padding
        expect(yScale(0)).toBeCloseTo(canvasHeight - padding);
        expect(yScale(200)).toBeCloseTo(padding);
    });

    it('handles zero-range domain for x (minX === maxX)', () => {
        const bounds: Bounds = { minX: 50, maxX: 50, minY: 0, maxY: 100 };
        const { xScale } = createScales(bounds, 400, 300);

        // After adjustment maxX becomes 50.001, scale should still be valid
        const result = xScale(50);
        expect(result).toBeCloseTo(CIRCUIT_PADDING);
    });

    it('handles zero-range domain for y (minY === maxY)', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 50, maxY: 50 };
        const { yScale } = createScales(bounds, 400, 300);

        const result = yScale(50);
        expect(result).toBeCloseTo(300 - CIRCUIT_PADDING);
    });

    it('respects a custom padding value', () => {
        const bounds: Bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
        const customPadding = 20;
        const { xScale } = createScales(bounds, 200, 200, customPadding);

        expect(xScale(0)).toBeCloseTo(customPadding);
        expect(xScale(10)).toBeCloseTo(200 - customPadding);
    });
});

describe('projectPoint', () => {
    it('maps a world-space point to pixel coordinates', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const scales = createScales(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(50, 50, scales);
        expect(sx).toBeCloseTo(250);
        expect(sy).toBeCloseTo(250);
    });

    it('maps the domain origin to the range start', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const scales = createScales(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(0, 0, scales);
        expect(sx).toBeCloseTo(0);
        expect(sy).toBeCloseTo(500); // y is inverted
    });

    it('maps the domain maximum to the range end', () => {
        const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        const scales = createScales(bounds, 500, 500, 0);

        const { sx, sy } = projectPoint(100, 100, scales);
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
