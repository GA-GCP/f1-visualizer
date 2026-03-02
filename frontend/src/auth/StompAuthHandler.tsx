import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { activateWithToken, stompClient } from '../api/stompClient';

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
                if (!cancelled) {
                    activateWithToken(token);
                }
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
