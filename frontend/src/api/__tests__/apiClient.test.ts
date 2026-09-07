import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('apiClient', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('creates axios instance with correct default base URL in development', async () => {
        // Default MODE in vitest is 'test', which maps to the development default path
        vi.stubEnv('MODE', 'development');

        const { apiClient } = await import('../apiClient');

        // In development mode (or any non-prod/uat/dev mode), the base URL defaults to '/api/v1'
        expect(apiClient.defaults.baseURL).toBe('/api/v1');
    });

    it('creates axios instance with prod base URL when MODE is prod', async () => {
        vi.stubEnv('MODE', 'prod');

        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.baseURL).toBe('https://api.f1visualizer.com/api/v1');
    });

    it('creates axios instance with uat base URL when MODE is uat', async () => {
        vi.stubEnv('MODE', 'uat');

        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.baseURL).toBe('https://uat.api.f1visualizer.com/api/v1');
    });

    it('creates axios instance with dev base URL when MODE is dev', async () => {
        vi.stubEnv('MODE', 'dev');

        const { apiClient } = await import('../apiClient');

        expect(apiClient.defaults.baseURL).toBe('https://dev.api.f1visualizer.com/api/v1');
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
});
