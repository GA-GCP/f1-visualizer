import { describe, it, expect } from 'vitest';
import { queryClient } from '../queryClient';

describe('queryClient defaults', () => {
    const defaults = queryClient.getDefaultOptions().queries;

    it('treats reference data as fresh for minutes, not milliseconds', () => {
        // Drivers, sessions and years change on a release cadence. The
        // hand-rolled caches this replaces never expired at all; the point of
        // a staleTime is that they now expire, but not on every mount.
        expect(defaults?.staleTime).toBe(5 * 60_000);
    });

    it('does not retry, because apiClient already does', () => {
        // apiClient applies a jittered, idempotent-only policy that honours
        // Retry-After. A second layer here would multiply the attempts.
        expect(defaults?.retry).toBe(false);
    });

    it('does not refetch on window focus', () => {
        // The live console is a long-lived tab; refetching reference data every
        // time it regains focus is request volume for no benefit.
        expect(defaults?.refetchOnWindowFocus).toBe(false);
    });
});
