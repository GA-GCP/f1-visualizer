import { describe, it, expect } from 'vitest';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { createCanvas } from 'canvas';
import {
    computeBounds,
    createScales,
    projectPoint,
    CIRCUIT_PADDING,
} from '../../utils/circuitProjection';

// Extend vitest matchers with jest-image-snapshot
expect.extend({ toMatchImageSnapshot });

/**
 * Visual regression tests for CircuitTrace rendering logic.
 *
 * These tests use node-canvas to render the same drawing operations
 * that CircuitTrace.tsx performs in the browser, then compare the
 * resulting PNG against a stored baseline snapshot.
 *
 * This catches visual regressions in:
 *   - Coordinate projection accuracy
 *   - Line thickness and color
 *   - Driver dot positioning
 *   - Scale/bounds calculations
 */

// Mock driver history representing a simple oval circuit
function createOvalCircuitHistory(): Record<number, { x: number; y: number }[]> {
    const history: Record<number, { x: number; y: number }[]> = {};

    // Driver 1 (selected) - full oval
    history[1] = [];
    for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        history[1].push({
            x: 5000 + 2000 * Math.cos(t),
            y: 3000 + 1000 * Math.sin(t),
        });
    }

    // Driver 44 (ghost) - partial oval, slightly offset
    history[44] = [];
    for (let i = 0; i <= 40; i++) {
        const t = (i / 60) * Math.PI * 2;
        history[44].push({
            x: 5000 + 2000 * Math.cos(t) + 50,
            y: 3000 + 1000 * Math.sin(t) + 30,
        });
    }

    return history;
}

/**
 * Renders the circuit trace to a node-canvas using the same logic
 * as the CircuitTrace component's animation loop.
 */
function renderCircuitToCanvas(
    width: number,
    height: number,
    history: Record<number, { x: number; y: number }[]>,
    selectedDriverId: number,
    selectedDriverColor: string
): Buffer {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Black background (matches component)
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, width, height);

    // Compute bounds from selected driver
    const bounds = computeBounds(history, selectedDriverId);
    const scales = createScales(bounds, width, height, CIRCUIT_PADDING);

    // Draw all driver traces (same logic as CircuitTrace.tsx render loop)
    Object.entries(history).forEach(([driverIdStr, driverHistory]) => {
        const driverId = parseInt(driverIdStr, 10);
        if (driverHistory.length < 2) return;

        const isSelected = driverId === selectedDriverId;

        ctx.beginPath();
        ctx.strokeStyle = isSelected ? selectedDriverColor : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = isSelected ? 4 : 1.5;
        ctx.lineJoin = 'round';

        const first = projectPoint(driverHistory[0].x, driverHistory[0].y, scales);
        ctx.moveTo(first.sx, first.sy);

        for (let i = 1; i < driverHistory.length; i++) {
            const pt = projectPoint(driverHistory[i].x, driverHistory[i].y, scales);
            ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.stroke();

        // Draw the "car" dot at the latest position
        const lastPoint = driverHistory[driverHistory.length - 1];
        const lastPt = projectPoint(lastPoint.x, lastPoint.y, scales);
        ctx.beginPath();
        ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)';
        ctx.arc(lastPt.sx, lastPt.sy, isSelected ? 6 : 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    return canvas.toBuffer('image/png');
}

describe('CircuitTrace Visual Regression', () => {
    it('renders an oval circuit with selected driver highlighted', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(800, 500, history, 1, '#3671C6');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-oval-selected',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
        });
    });

    it('renders a consistent trace at different canvas sizes', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(400, 250, history, 1, '#3671C6');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-oval-small',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
        });
    });

    it('renders with a different selected driver color (Ferrari red)', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(800, 500, history, 1, '#e10600');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-ferrari-red',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
        });
    });

    it('renders when ghost driver is selected instead', () => {
        const history = createOvalCircuitHistory();
        // Switch to driver 44 as the selected driver
        const image = renderCircuitToCanvas(800, 500, history, 44, '#00D2BE');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-ghost-selected',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
        });
    });

    it('renders a single driver with no ghosts', () => {
        const history: Record<number, { x: number; y: number }[]> = {
            1: createOvalCircuitHistory()[1],
        };
        const image = renderCircuitToCanvas(800, 500, history, 1, '#FF8700');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-single-driver',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
        });
    });
});
