import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { activateStomp, setStompTokenProvider, stompClient } from '../api/stompClient';

// Delay before the first STOMP activation after login (ms).
// On login, several REST calls fire concurrently (fetchDrivers, fetchSessions,
// GET /users/me).  The SockJS handshake (GET /ws/info) competes for the same
// rate-limit budget.  A short stagger lets the initial burst settle so the
// WebSocket handshake doesn't trip the 429 limiter on its first attempt.
const ACTIVATION_DELAY_MS = 2000;

/**
 * Manages the STOMP WebSocket lifecycle with Auth0 JWT tokens.
 *
 * Rather than capturing one token at activation, this registers a token
 * *provider* that the client's `beforeConnect` hook calls ahead of every
 * CONNECT — so library-driven reconnects send a fresh token instead of
 * replaying an expired one.
 */
export const StompAuthHandler: React.FC = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();

    useEffect(() => {
        if (!isAuthenticated) return;

        setStompTokenProvider(() => getAccessTokenSilently());

        const tid = setTimeout(activateStomp, ACTIVATION_DELAY_MS);

        return () => {
            clearTimeout(tid);
            setStompTokenProvider(null);
            if (stompClient.active) {
                void stompClient.deactivate();
            }
        };
    }, [isAuthenticated, getAccessTokenSilently]);

    return null;
};
