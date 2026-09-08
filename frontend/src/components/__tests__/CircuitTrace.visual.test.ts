import { createCanvas } from 'canvas';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { describe, it, expect } from 'vitest';
import { computeBounds } from '../../utils/circuitProjection';
import { drawFullTrace } from '../../utils/circuitRenderer';

// Extend vitest matchers with jest-image-snapshot
expect.extend({ toMatchImageSnapshot });

/**
 * Visual regression tests for CircuitTrace rendering logic.
 *
 * These call `drawFullTrace` — the same function CircuitTrace.tsx uses for its
 * full redraws — against node-canvas, then compare the PNG to a stored
 * baseline. The drawing code used to be duplicated here, so the suite verified
 * a second implementation the application never executed.
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

    const bounds = computeBounds(history, selectedDriverId);

    drawFullTrace(
        ctx,
        history,
        bounds,
        width,
        height,
        selectedDriverId,
        selectedDriverColor,
    );

    return canvas.toBuffer('image/png');
}

describe('CircuitTrace Visual Regression', () => {
    it('renders an oval circuit with selected driver highlighted', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(800, 500, history, 1, '#3671C6');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-oval-selected',
            // 0.0001 is a fraction, i.e. 0.01% of pixels — the tolerance the
            // README always claimed.  The previous 0.01 meant one *percent*
            // (about 4000 px on the 800x500 case), enough to hide a real
            // regression.
            failureThreshold: 0.0001,
            failureThresholdType: 'percent',
        });
    });

    it('renders a consistent trace at different canvas sizes', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(400, 250, history, 1, '#3671C6');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-oval-small',
            // 0.0001 is a fraction, i.e. 0.01% of pixels — the tolerance the
            // README always claimed.  The previous 0.01 meant one *percent*
            // (about 4000 px on the 800x500 case), enough to hide a real
            // regression.
            failureThreshold: 0.0001,
            failureThresholdType: 'percent',
        });
    });

    it('renders with a different selected driver color (Ferrari red)', () => {
        const history = createOvalCircuitHistory();
        const image = renderCircuitToCanvas(800, 500, history, 1, '#e10600');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-ferrari-red',
            // 0.0001 is a fraction, i.e. 0.01% of pixels — the tolerance the
            // README always claimed.  The previous 0.01 meant one *percent*
            // (about 4000 px on the 800x500 case), enough to hide a real
            // regression.
            failureThreshold: 0.0001,
            failureThresholdType: 'percent',
        });
    });

    it('renders when ghost driver is selected instead', () => {
        const history = createOvalCircuitHistory();
        // Switch to driver 44 as the selected driver
        const image = renderCircuitToCanvas(800, 500, history, 44, '#00D2BE');

        expect(image).toMatchImageSnapshot({
            customSnapshotIdentifier: 'circuit-trace-ghost-selected',
            // 0.0001 is a fraction, i.e. 0.01% of pixels — the tolerance the
            // README always claimed.  The previous 0.01 meant one *percent*
            // (about 4000 px on the 800x500 case), enough to hide a real
            // regression.
            failureThreshold: 0.0001,
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
            // 0.0001 is a fraction, i.e. 0.01% of pixels — the tolerance the
            // README always claimed.  The previous 0.01 meant one *percent*
            // (about 4000 px on the 800x500 case), enough to hide a real
            // regression.
            failureThreshold: 0.0001,
            failureThresholdType: 'percent',
        });
    });
});
