import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Loads a fresh copy of the config for a given environment. */
async function loadEnv(vars: Record<string, string>) {
    vi.resetModules();
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
    return import('../env');
}

const complete = {
    VITE_AUTH0_DOMAIN: 'tenant.us.auth0.com',
    VITE_AUTH0_CLIENT_ID: 'client-id',
    VITE_AUTH0_AUDIENCE: 'https://api.example.com',
    VITE_API_BASE_URL: 'https://dev.api.example.com/api/v1',
};

describe('env', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it('derives the WebSocket URL from the API origin', async () => {
        // Both used to be hard-coded in separate MODE ladders, so adding an
        // environment meant editing two of them and hoping they matched.
        const { env } = await loadEnv(complete);

        expect(env.apiBaseUrl).toBe('https://dev.api.example.com/api/v1');
        // wss:, and the raw WebSocket path Spring exposes for /ws.
        expect(env.wsUrl).toBe('wss://dev.api.example.com/ws/websocket');
    });

    it('points at the local proxy and broker when no API base URL is set', async () => {
        const { env } = await loadEnv({ ...complete, VITE_API_BASE_URL: '' });

        expect(env.apiBaseUrl).toBe('/api/v1');
        // Same-origin through the Vite proxy, on whatever port it is serving.
        expect(env.wsUrl).toMatch(/^ws:\/\/localhost:\d+\/ws\/websocket$/);
    });

    it('reports every missing required variable, not just the first', async () => {
        const { missingEnvVars } = await loadEnv({
            ...complete,
            VITE_AUTH0_DOMAIN: '',
            VITE_AUTH0_AUDIENCE: '',
        });

        expect(missingEnvVars).toEqual(['VITE_AUTH0_DOMAIN', 'VITE_AUTH0_AUDIENCE']);
    });

    it('reports nothing missing when the environment is complete', async () => {
        const { missingEnvVars } = await loadEnv(complete);

        expect(missingEnvVars).toEqual([]);
    });

    it('treats a malformed API base URL as local rather than crashing at import', async () => {
        const { env } = await loadEnv({ ...complete, VITE_API_BASE_URL: 'not-a-url' });

        expect(env.wsUrl).toMatch(/\/ws\/websocket$/);
    });
});
