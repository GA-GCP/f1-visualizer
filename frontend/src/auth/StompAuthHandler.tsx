import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { activateWithToken, stompClient } from '../api/stompClient';

// Delay before the first STOMP activation after login (ms).
// On login, several REST calls fire concurrently (fetchDrivers, fetchSessions,
// GET /users/me).  The SockJS handshake (GET /ws/info) competes for the same
// rate-limit budget.  A short stagger lets the initial burst settle so the
// WebSocket handshake doesn't trip the 429 limiter on its first attempt.
const ACTIVATION_DELAY_MS = 2000;

/**
 * Manages the STOMP WebSocket lifecycle with Auth0 JWT tokens.
 * Activates the STOMP client once the user is authenticated and
 * deactivates it on unmount.
 */
export const StompAuthHandler: React.FC = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();

    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;

        const connect = async () => {
            try {
                const token = await getAccessTokenSilently();
                if (cancelled) return;

                // Stagger: let initial REST requests clear the rate-limit window.
                await new Promise(resolve => setTimeout(resolve, ACTIVATION_DELAY_MS));
                if (cancelled) return;

                activateWithToken(token);
            } catch (error) {
                console.error('[STOMP] Failed to acquire Auth0 token for WebSocket', error);
            }
        };

        void connect();

        return () => {
            cancelled = true;
            if (stompClient.active) {
                stompClient.deactivate();
            }
        };
    }, [isAuthenticated, getAccessTokenSilently]);

    return null;
};
