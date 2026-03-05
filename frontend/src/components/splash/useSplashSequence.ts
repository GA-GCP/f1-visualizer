import { useState, useEffect, useRef } from 'react';

export type SplashPhase = 'background' | 'circuit' | 'text' | 'progress' | 'hold' | 'exit';

export interface SplashSequenceState {
    phase: SplashPhase;
    progress: number;
    elapsed: number;
}

const PHASE_THRESHOLDS: { maxMs: number; phase: SplashPhase }[] = [
    { maxMs: 300, phase: 'background' },
    { maxMs: 1200, phase: 'circuit' },
    { maxMs: 1500, phase: 'text' },
    { maxMs: 3000, phase: 'progress' },
    { maxMs: 3200, phase: 'hold' },
];

function getPhase(elapsed: number): SplashPhase {
    for (const { maxMs, phase } of PHASE_THRESHOLDS) {
        if (elapsed < maxMs) return phase;
    }
    return 'exit';
}

const TOTAL_DURATION = 3500;
const PROGRESS_DURATION = 3000;

const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useSplashSequence(onComplete: () => void): SplashSequenceState {
    const [state, setState] = useState<SplashSequenceState>(() =>
        prefersReducedMotion
            ? { phase: 'hold', progress: 1, elapsed: TOTAL_DURATION }
            : { phase: 'background', progress: 0, elapsed: 0 },
    );

    const onCompleteRef = useRef(onComplete);
    useEffect(() => {
        onCompleteRef.current = onComplete;
    });

    // Reduced motion: skip animations, fire onComplete after brief display
    useEffect(() => {
        if (!prefersReducedMotion) return;
        const timer = setTimeout(() => onCompleteRef.current(), 500);
        return () => clearTimeout(timer);
    }, []);

    // Full animation: RAF-driven timeline
    useEffect(() => {
        if (prefersReducedMotion) return;

        const start = performance.now();
        let rafId: number;
        let prevPhase: SplashPhase = 'background';
        let prevProgress = 0;

        const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / PROGRESS_DURATION, 1);
            const phase = getPhase(elapsed);

            if (phase !== prevPhase || Math.abs(progress - prevProgress) > 0.005) {
                prevPhase = phase;
                prevProgress = progress;
                setState({ phase, progress, elapsed });
            }

            if (elapsed >= TOTAL_DURATION) {
                onCompleteRef.current();
                return;
            }
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, []);

    return state;
}
