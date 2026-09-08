import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useSplashSequence } from '../useSplashSequence';
import type { SplashPhase } from '../useSplashSequence';

/**
 * Drives the hook's rAF timeline off fake timers so the completion rule — the
 * later of a 2 s brand minimum and a settled prefetch, capped at 7 s — can be
 * asserted directly. It used to be a fixed 7 s wall clock that nothing tested.
 */
function withFakeFrames() {
    let now = 0;
    let pending: FrameRequestCallback[] = [];

    vi.spyOn(performance, 'now').mockImplementation(() => now);
    // Driving the frame queue directly rather than mapping rAF onto setTimeout:
    // fake timers reject a handle created with setTimeout and cleared with
    // cancelAnimationFrame, which is exactly what the hook's cleanup does.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        pending.push(cb);
        return pending.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
        pending = [];
    });

    return {
        async advance(ms: number) {
            for (let elapsed = 0; elapsed < ms; elapsed += 16) {
                now += 16;
                const due = pending;
                pending = [];
                await act(async () => {
                    for (const cb of due) cb(now);
                });
            }
        },
    };
}

describe('useSplashSequence', () => {
    // matchMedia comes from src/test/setup.ts and reports matches: false, i.e.
    // no reduced-motion preference, which is the path under test here.
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('holds for the brand minimum even when everything is already loaded', async () => {
        const clock = withFakeFrames();
        const onComplete = vi.fn();

        renderHook(() => useSplashSequence(onComplete, { readiness: 1 }));

        await clock.advance(1500);
        expect(onComplete).not.toHaveBeenCalled();

        await clock.advance(700);
        expect(onComplete).toHaveBeenCalled();
    });

    it('ends as soon as the prefetch settles past the minimum, not on a 7 s clock', async () => {
        const clock = withFakeFrames();
        const onComplete = vi.fn();
        let readiness = 0.5;

        const { rerender } = renderHook(() => useSplashSequence(onComplete, { readiness }));

        await clock.advance(2500);
        expect(onComplete).not.toHaveBeenCalled();

        readiness = 1;
        rerender();
        await clock.advance(100);

        expect(onComplete).toHaveBeenCalled();
    });

    it('gives up at the 7 s cap when the prefetch never settles', async () => {
        const clock = withFakeFrames();
        const onComplete = vi.fn();

        renderHook(() => useSplashSequence(onComplete, { readiness: 0.25 }));

        await clock.advance(6500);
        expect(onComplete).not.toHaveBeenCalled();

        await clock.advance(700);
        expect(onComplete).toHaveBeenCalled();
    });

    it('ends immediately when the user skips', async () => {
        const clock = withFakeFrames();
        const onComplete = vi.fn();

        renderHook(() => useSplashSequence(onComplete, { readiness: 0, skipped: true }));

        await clock.advance(100);

        expect(onComplete).toHaveBeenCalled();
    });

    it('reports settled prefetch work as progress rather than elapsed time', async () => {
        const clock = withFakeFrames();
        const { result } = renderHook(() => useSplashSequence(vi.fn(), { readiness: 0.25 }));

        await clock.advance(1000);

        // Half the 2 s minimum has elapsed, but only a quarter of the work is done.
        expect(result.current.progress).toBe(0.25);
    });

    it('walks the phases in order', async () => {
        const clock = withFakeFrames();
        const seen: SplashPhase[] = [];
        const { result } = renderHook(() => useSplashSequence(vi.fn(), { readiness: 0 }));

        for (let i = 0; i < 6; i++) {
            await clock.advance(1000);
            const { phase } = result.current;
            if (seen[seen.length - 1] !== phase) seen.push(phase);
        }

        const order: SplashPhase[] = ['background', 'circuit', 'text', 'progress', 'hold', 'exit'];
        const indices = seen.map((p) => order.indexOf(p));
        expect(indices).toEqual([...indices].sort((a, b) => a - b));
        expect(seen.length).toBeGreaterThan(1);
    });
});
