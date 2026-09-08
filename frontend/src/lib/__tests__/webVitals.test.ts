import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatch, reportWebVitals, setVitalsSink, toReport } from '../webVitals';

afterEach(() => setVitalsSink(null));

describe('web vitals', () => {
    it('stamps every metric with the build that produced it', () => {
        // A metric without a version cannot be compared across deploys, which
        // is the only thing anyone actually wants to do with these.
        const report = toReport({ name: 'LCP', value: 1234.56, rating: 'good' });

        expect(report).toMatchObject({ name: 'LCP', value: 1234.56, rating: 'good', version: 'test' });
    });

    it('routes a measurement to an installed sink instead of the beacon', () => {
        const sink = vi.fn();
        setVitalsSink(sink);

        dispatch({ name: 'INP', value: 42, rating: 'good' });

        expect(sink).toHaveBeenCalledOnce();
        expect(sink.mock.calls[0][0]).toMatchObject({ name: 'INP', version: 'test' });
        expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });

    it('sends nothing when no collector is configured', () => {
        // The audit's suggested fix posted to a hard-coded /api/v1/rum. That
        // route does not exist on the gateway, so this asserts the absence of
        // a 404 on every page view rather than the presence of a beacon.
        expect(import.meta.env.VITE_RUM_ENDPOINT).toBeUndefined();

        dispatch({ name: 'CLS', value: 0.01, rating: 'good' });

        expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });

    it('stays silent when the Performance API is incomplete', async () => {
        // main.tsx does not await this, so a throw would land in the global
        // unhandled-rejection handler and the app would report itself broken
        // because its own instrumentation is. jsdom reaches that path for real:
        // it has no performance.getEntriesByType.
        await expect(reportWebVitals()).resolves.toBeUndefined();
    });
});
