import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('apiClient', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('falls back to the Vite proxy path when no API base URL is configured', async () => {
        vi.stubEnv('VITE_API_BASE_URL', '');

        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.baseURL).toBe('/api/v1');
    });

    it('takes its base URL from configuration, not from a MODE ladder', async () => {
        // The origin used to be decided by an if-chain on MODE here, in
        // stompClient, in three .env files and in the nginx CSP map — five
        // sources for one fact.
        vi.stubEnv('VITE_API_BASE_URL', 'https://staging.api.example.com/api/v1');

        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.baseURL).toBe('https://staging.api.example.com/api/v1');
    });

    it('applies a request timeout', async () => {
        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.timeout).toBe(15_000);
    });

    describe('a 401 fails closed', () => {
        /**
         * Loads apiClient against a mock axios and hands back its rejection
         * handler, rather than reaching into the private `handlers` array.
         */
        async function loadWithMockAxios() {
            let onRejected: ((err: unknown) => unknown) | undefined;
            const instance = vi.fn();

            vi.doMock('axios', () => {
                const client = Object.assign(instance, {
                    defaults: { baseURL: '/api/v1' },
                    interceptors: {
                        response: {
                            use: (_ok: unknown, rejected: (err: unknown) => unknown) => {
                                onRejected = rejected;
                            },
                        },
                    },
                });
                return { default: { create: () => client } };
            });

            const mod = await import('../apiClient');
            return { onRejected: onRejected!, instance, ...mod };
        }

        it('retries once with a freshly-minted token', async () => {
            vi.stubEnv('MODE', 'development');
            const { onRejected, instance, setAuthHandlers } = await loadWithMockAxios();

            const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
            setAuthHandlers({ refreshAccessToken, onAuthExpired: vi.fn() });
            instance.mockResolvedValue({ data: 'ok' });

            const config = { headers: {} as Record<string, string> };
            const result = await onRejected({ response: { status: 401 }, config });

            expect(refreshAccessToken).toHaveBeenCalledTimes(1);
            expect(config.headers.Authorization).toBe('Bearer fresh-token');
            expect(result).toEqual({ data: 'ok' });
        });

        it('re-authenticates and rejects with AuthExpiredError when the retry also fails', async () => {
            vi.stubEnv('MODE', 'development');
            const { onRejected, setAuthHandlers, AuthExpiredError } = await loadWithMockAxios();

            const onAuthExpired = vi.fn();
            setAuthHandlers({
                refreshAccessToken: vi.fn().mockRejectedValue(new Error('login_required')),
                onAuthExpired,
            });

            const config = { headers: {} as Record<string, string> };

            // A distinguishable error: an expired session and an outage used to
            // be presented to the user identically.
            await expect(onRejected({ response: { status: 401 }, config }))
                .rejects.toBeInstanceOf(AuthExpiredError);
            expect(onAuthExpired).toHaveBeenCalledTimes(1);
        });

        it('does not retry a request that has already been retried', async () => {
            vi.stubEnv('MODE', 'development');
            const { onRejected, setAuthHandlers, AuthExpiredError } = await loadWithMockAxios();

            const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
            const onAuthExpired = vi.fn();
            setAuthHandlers({ refreshAccessToken, onAuthExpired });

            const config = { headers: {}, _authRetried: true };

            await expect(onRejected({ response: { status: 401 }, config }))
                .rejects.toBeInstanceOf(AuthExpiredError);
            expect(refreshAccessToken).not.toHaveBeenCalled();
            expect(onAuthExpired).toHaveBeenCalledTimes(1);
        });
    });

    describe('retryAfterMs', () => {
        it('reads a delay given in seconds', async () => {
            const { retryAfterMs } = await import('../apiClient');
            expect(retryAfterMs('5')).toBe(5000);
        });

        it('reads an HTTP-date, which parseInt used to turn into NaN', async () => {
            const { retryAfterMs } = await import('../apiClient');
            const tenSecondsOut = new Date(Date.now() + 10_000).toUTCString();

            const ms = retryAfterMs(tenSecondsOut);

            expect(ms).toBeGreaterThan(8_000);
            expect(ms).toBeLessThanOrEqual(10_000);
        });

        it('caps an absurd delay rather than sleeping for it', async () => {
            const { retryAfterMs } = await import('../apiClient');
            expect(retryAfterMs('99999')).toBe(30_000);
        });

        it('returns undefined for a missing or unparseable header', async () => {
            const { retryAfterMs } = await import('../apiClient');
            expect(retryAfterMs(undefined)).toBeUndefined();
            expect(retryAfterMs('not-a-date')).toBeUndefined();
        });
    });
});
