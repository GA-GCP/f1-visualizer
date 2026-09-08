import { createLogger } from './logger';
import { dispatch } from './webVitals';

const log = createLogger('perf');

/**
 * Both operands are replaced at build time, so this folds to a constant and the
 * bodies below become branches the engine never takes in a build with no
 * collector configured. See main.tsx for the same gate on web-vitals itself.
 */
const ENABLED = import.meta.env.DEV || Boolean(import.meta.env.VITE_RUM_ENDPOINT);

/**
 * Application metrics, alongside the standard Web Vitals.
 *
 * LCP and INP describe loading a page. They say nothing about the two things
 * this app is actually judged on: how long the telemetry socket takes to
 * deliver its first packet, and whether the trace holds 60 fps once it does.
 * Both go through the same sink as the Web Vitals, so a collector receives one
 * stream stamped with one build.
 */
export const MARK = {
    sessionStart: 'f1v:session-start',
    stompConnected: 'f1v:stomp-connected',
    firstPacket: 'f1v:first-packet',
} as const;

export function mark(name: string): void {
    if (!ENABLED) return;
    try {
        performance.mark(name);
    } catch (error) {
        // Not every environment implements the User Timing API.
        log.debug('mark failed', name, error);
    }
}

/**
 * Reports the gap between two marks, once, as a metric.
 *
 * Silently does nothing if either mark is missing — a session that never
 * connected has no time-to-first-packet, and that is not an error worth
 * reporting as one.
 */
export function measureBetween(name: string, startMark: string, endMark: string): void {
    if (!ENABLED) return;
    try {
        const measure = performance.measure(name, startMark, endMark);
        dispatch({ name, value: measure.duration, rating: 'custom' });
    } catch (error) {
        log.debug('measure failed', name, error);
    }
}

/** A frame slower than this is counted as dropped: 1.5x a 60 Hz budget. */
const FRAME_BUDGET_MS = (1000 / 60) * 1.5;

/** How often the frame health of a live session is reported. */
const FRAME_REPORT_INTERVAL_MS = 60_000;

export interface FrameMonitor {
    /** Call once per animation frame with the frame's timestamp. */
    frame(now: number): void;
    /** Report whatever has accumulated and reset. */
    flush(now: number): void;
}

/**
 * Counts frames that missed the budget during a live session.
 *
 * The 60 fps trace is the app's core value and regressions in it were
 * previously discovered by users. This is a counter and two comparisons per
 * frame — cheaper than the work it measures, and it reports a ratio rather
 * than a stream so a long session sends one metric a minute, not 3,600.
 */
export function createFrameMonitor(): FrameMonitor {
    // null rather than 0 as the 'no previous frame yet' sentinel: rAF
    // timestamps are relative to the time origin and legitimately start at or
    // near 0, so a 0 sentinel swallows the first real frames as baselines.
    let previous: number | null = null;
    let total = 0;
    let dropped = 0;
    let windowStart = 0;

    const flush = (now: number) => {
        if (total > 0) {
            dispatch({
                name: 'f1v:dropped-frame-ratio',
                value: dropped / total,
                rating: 'custom',
            });
        }
        total = 0;
        dropped = 0;
        windowStart = now;
    };

    return {
        frame(now: number) {
            if (!ENABLED) return;

            if (previous === null) {
                previous = now;
                windowStart = now;
                return;
            }

            if (now - previous > FRAME_BUDGET_MS) dropped++;
            total++;
            previous = now;

            if (now - windowStart >= FRAME_REPORT_INTERVAL_MS) flush(now);
        },
        flush,
    };
}
