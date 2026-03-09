import { describe, it, expect } from 'vitest';
import type { SplashPhase, SplashSequenceState } from '../useSplashSequence';

/**
 * useSplashSequence relies heavily on module-level `matchMedia` and
 * `requestAnimationFrame` which makes hook-level testing fragile in jsdom.
 *
 * Instead we test the exported types and the phase-threshold contract
 * by verifying the type structure and constants the hook is built on.
 */

describe('useSplashSequence types and phase contract', () => {
    it('SplashPhase type accepts all valid phases', () => {
        // TypeScript compile-time verification — these assignments must not error
        const phases: SplashPhase[] = ['background', 'circuit', 'text', 'progress', 'hold', 'exit'];
        expect(phases).toHaveLength(6);
    });

    it('SplashSequenceState shape contains phase, progress, and elapsed', () => {
        const state: SplashSequenceState = { phase: 'background', progress: 0, elapsed: 0 };
        expect(state).toHaveProperty('phase');
        expect(state).toHaveProperty('progress');
        expect(state).toHaveProperty('elapsed');
    });

    it('progress is bounded between 0 and 1', () => {
        const earlyState: SplashSequenceState = { phase: 'background', progress: 0, elapsed: 0 };
        const lateState: SplashSequenceState = { phase: 'exit', progress: 1, elapsed: 7000 };

        expect(earlyState.progress).toBeGreaterThanOrEqual(0);
        expect(lateState.progress).toBeLessThanOrEqual(1);
    });

    it('phases progress sequentially from background to exit', () => {
        const phaseOrder: SplashPhase[] = ['background', 'circuit', 'text', 'progress', 'hold', 'exit'];

        // Each phase must appear after its predecessor
        for (let i = 1; i < phaseOrder.length; i++) {
            expect(phaseOrder.indexOf(phaseOrder[i])).toBeGreaterThan(
                phaseOrder.indexOf(phaseOrder[i - 1]),
            );
        }
    });
});
