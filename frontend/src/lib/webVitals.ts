import { buildInfo } from './buildInfo';
import { createLogger } from './logger';

const log = createLogger('vitals');

/** The subset of web-vitals' Metric that is worth sending anywhere. */
export interface VitalsReport {
    name: string;
    value: number;
    rating: string;
    /** Which build produced it — a metric without this cannot be compared. */
    version: string;
    mode: string;
}

/**
 * Where measurements go.
 *
 * A seam rather than a hard dependency, matching `logger.setErrorSink`: which
 * collector receives these is a deployment decision, and this is the single
 * place it attaches.
 */
let sink: ((report: VitalsReport) => void) | null = null;

export function setVitalsSink(next: ((report: VitalsReport) => void) | null): void {
    sink = next;
}

/**
 * Posts to VITE_RUM_ENDPOINT with sendBeacon, which survives the unload that
 * delivers most of these metrics — a fetch() there is cancelled.
 *
 * The audit's suggested fix hard-coded `/api/v1/rum`. That endpoint does not
 * exist on the gateway, so every page view would have produced a 404 and the
 * CSP would have had to allow an origin nothing was listening on. Sending only
 * when an endpoint is configured keeps the instrumentation in place and makes
 * turning it on a config change rather than a code change.
 */
function beaconSink(report: VitalsReport): void {
    const endpoint = import.meta.env.VITE_RUM_ENDPOINT;
    if (!endpoint) return;

    // Absent in jsdom and in some older webviews. Feature-detected rather than
    // left to the catch below, so a missing API is not reported as a failure.
    if (typeof navigator.sendBeacon !== 'function') return;

    try {
        navigator.sendBeacon(endpoint, JSON.stringify(report));
    } catch (error) {
        // Losing a metric must never be visible to the user.
        log.debug('beacon failed', error);
    }
}

/** Normalises a web-vitals Metric into what a collector actually needs. */
export function toReport(metric: { name: string; value: number; rating: string }): VitalsReport {
    return {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        version: buildInfo.version,
        mode: buildInfo.mode,
    };
}

/**
 * Sends one measurement to whichever destination is configured.
 *
 * Separated from `reportWebVitals` because this is the part with a decision in
 * it. The collection itself is web-vitals' job and cannot be meaningfully
 * exercised outside a browser that paints.
 */
export function dispatch(metric: { name: string; value: number; rating: string }): void {
    const report = toReport(metric);
    log.debug(`${report.name} ${Math.round(report.value)} (${report.rating})`);
    (sink ?? beaconSink)(report);
}

/**
 * Starts LCP / INP / CLS / TTFB / FCP collection.
 *
 * The import is dynamic so web-vitals lands in its own chunk instead of the
 * entry: measuring the first paint should not be one of the things the browser
 * downloads before it.
 *
 * Nothing here is allowed to escape. main.tsx calls this without awaiting it,
 * so a throw would surface as an unhandled rejection in the global handler —
 * an app reporting itself broken because its own instrumentation is. web-vitals
 * reads the Performance API eagerly and not every environment implements all
 * of it (jsdom has no `performance.getEntriesByType`), so this is reachable.
 */
export async function reportWebVitals(): Promise<void> {
    try {
        const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');
        for (const observe of [onCLS, onFCP, onINP, onLCP, onTTFB]) {
            observe(dispatch);
        }
    } catch (error) {
        log.debug('web-vitals unavailable', error);
    }
}
