import { useState, useEffect, useRef } from 'react';

export type SplashPhase = 'background' | 'circuit' | 'text' | 'progress' | 'hold' | 'exit';

export interface SplashSequenceState {
    phase: SplashPhase;
    progress: number;
    elapsed: number;
}

const PHASE_THRESHOLDS: { maxMs: number; phase: SplashPhase }[] = [
    { maxMs: 600, phase: 'background' },
    { maxMs: 2400, phase: 'circuit' },
    { maxMs: 3000, phase: 'text' },
    { maxMs: 6000, phase: 'progress' },
    { maxMs: 6400, phase: 'hold' },
];

function getPhase(elapsed: number): SplashPhase {
    for (const { maxMs, phase } of PHASE_THRESHOLDS) {
        if (elapsed < maxMs) return phase;
    }
    return 'exit';
}

/**
 * The brand moment is worth protecting, so the splash never ends before this —
 * otherwise a warm cache would flash it away in 200 ms.
 */
const BRAND_MINIMUM = 2000;

/**
 * Hard cap. Past this the splash ends whether the prefetch has settled or not:
 * the app is mounted underneath and every page reports its own loading state,
 * so a slow network should not also mean a longer gate.
 */
const MAX_DURATION = 7000;

/**
 * Read at mount rather than at module evaluation.  As a module-level constant
 * this ran on import — which threw in any environment without matchMedia, and
 * froze the answer for the lifetime of the page, so toggling the OS setting in
 * an open tab had no effect.
 */
function readPrefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export interface SplashSequenceOptions {
    /** 0..1 — how much of the startup prefetch has settled. */
    readiness: number;
    /** Set when the user asks to skip; ends the sequence on the next frame. */
    skipped?: boolean;
}

export function useSplashSequence(
    onComplete: () => void,
    { readiness, skipped = false }: SplashSequenceOptions,
): SplashSequenceState {
    const [prefersReducedMotion] = useState(readPrefersReducedMotion);

    const [state, setState] = useState<SplashSequenceState>(() =>
        prefersReducedMotion
            ? { phase: 'hold', progress: readiness, elapsed: MAX_DURATION }
            : { phase: 'background', progress: readiness, elapsed: 0 },
    );

    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    });

    // Read inside the rAF loop, which must not be restarted when these change.
    // Written from an effect, not during render — mutating a ref while
    // rendering is not allowed, and the one-frame lag is immaterial at 60 Hz.
    const readinessRef = useRef(readiness);
    const skippedRef = useRef(skipped);
    useEffect(() => {
        readinessRef.current = readiness;
        skippedRef.current = skipped;
    }, [readiness, skipped]);

    // Reduced motion: skip animations, fire onComplete after brief display
    useEffect(() => {
        if (!prefersReducedMotion) return;
        const timer = setTimeout(() => onCompleteRef.current(), 500);
        return () => clearTimeout(timer);
    }, [prefersReducedMotion]);

    // Full animation: RAF-driven timeline
    useEffect(() => {
        if (prefersReducedMotion) return;

        const start = performance.now();
        let rafId: number;
        let prevPhase: SplashPhase = 'background';
        let prevProgress = 0;

        const tick = (now: number) => {
            const elapsed = now - start;
            // The bar reports settled prefetch work, not time. A clock-driven bar
            // claimed progress it had no knowledge of, then handed over to a
            // dashboard still showing spinners.
            const progress = readinessRef.current;
            const phase = getPhase(elapsed);

            if (phase !== prevPhase || Math.abs(progress - prevProgress) > 0.005) {
                prevPhase = phase;
                prevProgress = progress;
                setState({ phase, progress, elapsed });
            }

            const ready = elapsed >= BRAND_MINIMUM && readinessRef.current >= 1;
            if (skippedRef.current || ready || elapsed >= MAX_DURATION) {
                setState({ phase: 'exit', progress, elapsed });
                onCompleteRef.current();
                return;
            }
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [prefersReducedMotion]);

    return state;
}
