import { describe, it, expect } from 'vitest';
import { requireAccessToken } from '../accessToken';

describe('requireAccessToken', () => {
    it('passes a token through', async () => {
        await expect(requireAccessToken(Promise.resolve('token'))).resolves.toBe('token');
    });

    it('rejects when Auth0 resolves with no token', async () => {
        // cacheMode 'cache-only' with an empty cache resolves to undefined
        // rather than throwing; for the callers here that has to be a failure.
        const missing = requireAccessToken(Promise.resolve(undefined));
        await expect(missing).rejects.toThrow('Auth0 returned no access token');
    });

    it('rejects an empty token, which no Authorization header could carry', async () => {
        await expect(requireAccessToken(Promise.resolve(''))).rejects.toThrow();
    });

    it('propagates a rejection unchanged', async () => {
        const failure = new Error('network down');
        await expect(requireAccessToken(Promise.reject(failure))).rejects.toBe(failure);
    });
});
