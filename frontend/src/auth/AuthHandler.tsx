import React, { useEffect } from 'react';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation } from 'react-router-dom';
import { apiClient, setAuthHandlers } from '../api/apiClient';
import { claimLoginRedirect } from './loginRedirectGuard';
import { createLogger } from '../lib/logger';

const log = createLogger('auth');

/**
 * Auth0 error codes that mean "silent renewal cannot work; the user has to log
 * in interactively". Anything else is treated as a transient failure.
 */
const INTERACTIVE_LOGIN_REQUIRED = new Set([
    'login_required',
    'consent_required',
    'missing_refresh_token',
]);

export const AxiosAuthInterceptor: React.FC = () => {
    const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
    const location = useLocation();

    useEffect(() => {
        const returnTo = location.pathname + location.search;

        const reauthenticate = () => {
            // At most one interactive login per page load, however many
            // requests fail at once.
            if (!claimLoginRedirect()) return;
            void loginWithRedirect({ appState: { returnTo } });
        };

        // apiClient is a module singleton with no access to hooks, so the two
        // things it needs from Auth0 are handed to it here.
        setAuthHandlers({
            // cacheMode 'off' forces a new token rather than returning the
            // cached one the server has just rejected.
            refreshAccessToken: () => getAccessTokenSilently({ cacheMode: 'off' }),
            onAuthExpired: reauthenticate,
        });

        const requestInterceptor = apiClient.interceptors.request.use(async (config) => {
            if (!isAuthenticated) return config;

            try {
                const token = await getAccessTokenSilently();
                config.headers.Authorization = `Bearer ${token}`;
                return config;
            } catch (error) {
                // Previously this logged and let the request through with no
                // bearer. The backend answered 401, the 401 branch only warned,
                // and isAuthenticated stays true on a token failure — so the app
                // kept rendering and every data hook failed on its own, with no
                // way to recover but a manual reload.
                const code = (error as { error?: string }).error;
                if (code && INTERACTIVE_LOGIN_REQUIRED.has(code)) {
                    reauthenticate();
                } else {
                    log.error('Failed to acquire Auth0 access token', error);
                }

                // Cancel rather than send: an authenticated endpoint should
                // never receive a credential-less request.
                throw new axios.Cancel('Authentication required');
            }
        });

        return () => {
            apiClient.interceptors.request.eject(requestInterceptor);
            setAuthHandlers({ refreshAccessToken: null, onAuthExpired: null });
        };
    }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect, location.pathname, location.search]);

    return null;
};
