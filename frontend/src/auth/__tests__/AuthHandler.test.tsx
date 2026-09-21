import { useAuth0 } from '@auth0/auth0-react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAccessTokenSilently = vi.fn();
const mockLoginWithRedirect = vi.fn();

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }));

vi.mock('../../api/apiClient', () => ({
    apiClient: {
        interceptors: {
            request: {
                use: vi.fn().mockReturnValue(42),
                eject: vi.fn(),
            },
        },
    },
    setAuthHandlers: vi.fn(),
}));

import { apiClient, setAuthHandlers } from '../../api/apiClient';
import { AxiosAuthInterceptor } from '../AuthHandler';
import { resetLoginRedirectGuard } from '../loginRedirectGuard';

interface Config {
    headers: Record<string, string>;
}

const mockAuth0 = (isAuthenticated: boolean) => {
    (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        getAccessTokenSilently: mockGetAccessTokenSilently,
        loginWithRedirect: mockLoginWithRedirect,
        isAuthenticated,
    });
};

const renderAt = (path = '/dashboard') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <AxiosAuthInterceptor />
        </MemoryRouter>,
    );

/** The request interceptor the component registered. */
const registeredInterceptor = () =>
    vi.mocked(apiClient.interceptors.request.use).mock.calls[0][0] as unknown as (
        config: Config,
    ) => Promise<Config>;

describe('AxiosAuthInterceptor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // The single-flight login guard is module state by design.
        resetLoginRedirectGuard();
    });

    it('attaches a bearer token when authenticated', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('mock-auth-token');
        mockAuth0(true);

        renderAt();

        expect(apiClient.interceptors.request.use).toHaveBeenCalledTimes(1);
        const config = await registeredInterceptor()({ headers: {} });

        expect(config.headers.Authorization).toBe('Bearer mock-auth-token');
    });

    it('does not ask for a token when not authenticated', async () => {
        mockAuth0(false);

        renderAt();
        const config = await registeredInterceptor()({ headers: {} });

        expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
        expect(config.headers.Authorization).toBeUndefined();
    });

    describe('when a token cannot be acquired', () => {
        it('cancels the request rather than sending it unauthenticated', async () => {
            // The old behaviour logged and let the request through with no
            // bearer, so authenticated endpoints received credential-less calls.
            mockGetAccessTokenSilently.mockRejectedValue({ error: 'login_required' });
            mockAuth0(true);

            renderAt();

            await expect(registeredInterceptor()({ headers: {} })).rejects.toThrow();
        });

        it.each(['login_required', 'consent_required', 'missing_refresh_token'])(
            're-authenticates on %s',
            async (code) => {
                mockGetAccessTokenSilently.mockRejectedValue({ error: code });
                mockAuth0(true);

                renderAt('/versus?a=1&b=16');
                await expect(registeredInterceptor()({ headers: {} })).rejects.toThrow();

                // ...and comes back to where the user was.
                expect(mockLoginWithRedirect).toHaveBeenCalledWith({
                    appState: { returnTo: '/versus?a=1&b=16' },
                });
            },
        );

        it('does not force a login for a transient failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockGetAccessTokenSilently.mockRejectedValue(new Error('network down'));
            mockAuth0(true);

            renderAt();
            await expect(registeredInterceptor()({ headers: {} })).rejects.toThrow();

            expect(mockLoginWithRedirect).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('treats a resolved-but-missing token as a failure, not as a bearer', async () => {
            // auth0-react 2.25 types getAccessTokenSilently() as string | undefined.
            // Nothing here uses cacheMode 'cache-only', so undefined is a fault,
            // and the request must not go out as `Bearer undefined`.
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockGetAccessTokenSilently.mockResolvedValue(undefined);
            mockAuth0(true);

            renderAt();
            await expect(registeredInterceptor()({ headers: {} })).rejects.toThrow();

            expect(mockLoginWithRedirect).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    it('gives apiClient a cache-bypassing refresher for its 401 retry', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('fresh-token');
        mockAuth0(true);

        renderAt();

        const handlers = vi.mocked(setAuthHandlers).mock.calls[0][0];
        await expect(handlers.refreshAccessToken!()).resolves.toBe('fresh-token');
        // 'off' is the point: the cached token is the one the server rejected.
        expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({ cacheMode: 'off' });
    });

    it('makes the refresher reject when Auth0 resolves with no token', async () => {
        // A rejected refresher is what apiClient falls through to
        // re-authentication on; an undefined token must take the same path.
        mockGetAccessTokenSilently.mockResolvedValue(undefined);
        mockAuth0(true);

        renderAt();

        const handlers = vi.mocked(setAuthHandlers).mock.calls[0][0];
        await expect(handlers.refreshAccessToken!()).rejects.toThrow();
    });

    it('ejects the interceptor and clears the handlers on unmount', () => {
        mockAuth0(true);

        const { unmount } = renderAt();
        unmount();

        expect(apiClient.interceptors.request.eject).toHaveBeenCalledWith(42);
        expect(setAuthHandlers).toHaveBeenLastCalledWith({
            refreshAccessToken: null,
            onAuthExpired: null,
        });
    });

    it('starts only one interactive login when several requests fail together', async () => {
        // A page load fires multiple requests in parallel; if the session has
        // expired they all fail at once.
        mockGetAccessTokenSilently.mockRejectedValue({ error: 'login_required' });
        mockAuth0(true);

        renderAt();
        const interceptor = registeredInterceptor();

        await Promise.allSettled([
            interceptor({ headers: {} }),
            interceptor({ headers: {} }),
            interceptor({ headers: {} }),
        ]);

        expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
    });
});
