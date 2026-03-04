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

    it('response interceptor logs warning on 401', async () => {
        vi.stubEnv('MODE', 'development');

        // Capture the rejected handler via a mock axios instead of
        // reaching into the private `handlers` array (which is an
        // internal implementation detail that differs across environments).
        let capturedErrorHandler: ((err: unknown) => unknown) | undefined;

        vi.doMock('axios', () => ({
            default: {
                create: () => ({
                    defaults: { baseURL: '/api/v1' },
                    interceptors: {
                        response: {
                            use: (_onFulfilled: unknown, onRejected: (err: unknown) => unknown) => {
                                capturedErrorHandler = onRejected;
                            }
                        }
                    }
                })
            }
        }));

        await import('../apiClient');

        expect(capturedErrorHandler).toBeDefined();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            await capturedErrorHandler!({ response: { status: 401 } });
        } catch {
            // Expected to reject (the interceptor returns Promise.reject)
        }

        expect(warnSpy).toHaveBeenCalledWith('[API] Unauthorized. User session may have expired.');

        warnSpy.mockRestore();
    });
});
