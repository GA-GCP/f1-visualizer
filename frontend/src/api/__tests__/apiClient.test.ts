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

        const { apiClient } = await import('../apiClient');

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Access the interceptor's error handler from the internal handlers array.
        // In axios v1, interceptors.response.handlers is an array of
        // { fulfilled, rejected } objects.
        const handlers = (apiClient.interceptors.response as unknown as { handlers: Array<{ fulfilled: unknown; rejected: (err: unknown) => Promise<unknown> }> }).handlers;
        const errorHandler = handlers[0].rejected;

        try {
            await errorHandler({ response: { status: 401 } });
        } catch {
            // Expected to reject (the interceptor returns Promise.reject)
        }

        expect(warnSpy).toHaveBeenCalledWith('[API] Unauthorized. User session may have expired.');

        warnSpy.mockRestore();
    });
});
