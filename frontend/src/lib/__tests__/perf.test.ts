import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameMonitor, MARK, mark, measureBetween } from '../perf';
import { setVitalsSink, type VitalsReport } from '../webVitals';

let reports: VitalsReport[];

beforeEach(() => {
    reports = [];
    setVitalsSink((report) => reports.push(report));
    performance.clearMarks?.();
});

afterEach(() => setVitalsSink(null));

/** 60 Hz is 16.67 ms; the monitor's budget is 1.5x that. */
const GOOD_FRAME = 16;
const SLOW_FRAME = 40;

describe('frame monitor', () => {
    it('reports the share of frames that missed the budget', () => {
        const monitor = createFrameMonitor();
        let now = 0;

        // First call only establishes a baseline — there is no previous frame
        // to have been late relative to.
        monitor.frame(now);
        for (let i = 0; i < 3; i++) monitor.frame((now += GOOD_FRAME));
        monitor.frame((now += SLOW_FRAME));

        monitor.flush(now);

        expect(reports).toHaveLength(1);
        expect(reports[0].name).toBe('f1v:dropped-frame-ratio');
        expect(reports[0].value).toBeCloseTo(1 / 4);
    });

    it('reports once a minute rather than once a frame', () => {
        // A 20-minute session at 60 fps is 72,000 frames. Sending one metric
        // each would cost more than the thing being measured.
        const monitor = createFrameMonitor();
        let now = 0;
        monitor.frame(now);
        for (let i = 0; i < 61_000 / GOOD_FRAME; i++) monitor.frame((now += GOOD_FRAME));

        expect(reports).toHaveLength(1);
    });

    it('reports a partial window on teardown instead of discarding it', () => {
        // A session that ends after 40 seconds is still evidence.
        const monitor = createFrameMonitor();
        monitor.frame(0);
        monitor.frame(GOOD_FRAME);

        monitor.flush(GOOD_FRAME * 2);

        expect(reports).toHaveLength(1);
    });

    it('says nothing when no frames were observed', () => {
        createFrameMonitor().flush(0);

        expect(reports).toHaveLength(0);
    });
});

describe('marks', () => {
    it('measures the gap between two marks and reports it', () => {
        mark(MARK.stompConnected);
        mark(MARK.firstPacket);

        measureBetween('f1v:stomp-ttfp', MARK.stompConnected, MARK.firstPacket);

        expect(reports).toHaveLength(1);
        expect(reports[0].name).toBe('f1v:stomp-ttfp');
        expect(reports[0].value).toBeGreaterThanOrEqual(0);
    });

    it('stays quiet when a mark is missing', () => {
        // A session that never connected has no time-to-first-packet, and that
        // is not an error worth reporting as one.
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        measureBetween('f1v:stomp-ttfp', 'never:marked', 'also:never');

        expect(reports).toHaveLength(0);
        expect(error).not.toHaveBeenCalled();
    });
});
