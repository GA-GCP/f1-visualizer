import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let wsUrl = 'http://localhost:8080/ws';
if (import.meta.env.MODE === 'prod') {
    wsUrl = 'https://api.f1visualizer.com/ws';
} else if (import.meta.env.MODE === 'uat') {
    wsUrl = 'https://uat.api.f1visualizer.com/ws';
} else if (import.meta.env.MODE === 'dev') {
    wsUrl = 'https://dev.api.f1visualizer.com/ws';
}

// Exponential backoff + circuit breaker for STOMP reconnection.
// The SockJS handshake (GET /ws/info) bypasses the Axios 429 interceptor,
// so each reconnection attempt consumes rate-limit budget.  Without a hard
// stop the client perpetuates its own 429 cycle indefinitely.
const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;
const MAX_RECONNECT_ATTEMPTS = 6; // 5s+10s+20s+40s+60s+60s ≈ 3 min then stop
let reconnectAttempts = 0;

/** Add ±25 % jitter so concurrent tabs / clients don't synchronise retries. */
function jitter(delay: number): number {
    return Math.round(delay * (0.75 + Math.random() * 0.5));
}

export const stompClient = new Client({
    webSocketFactory: () => new SockJS(wsUrl),
    reconnectDelay: BASE_RECONNECT_DELAY,
    heartbeatIncoming: 10000, // Wait for heartbeat every 10s
    heartbeatOutgoing: 10000, // Send heartbeat every 10s
    debug: (str) => console.log('[STOMP]:', str),
    onConnect: () => {
        reconnectAttempts = 0;
        stompClient.reconnectDelay = BASE_RECONNECT_DELAY;
        console.log('[STOMP]: Connected, backoff reset');
    },
    onWebSocketClose: () => {
        reconnectAttempts++;

        // Circuit breaker — stop hammering the server after repeated failures.
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            stompClient.reconnectDelay = 0; // 0 disables auto-reconnect in @stomp/stompjs
            console.error(
                `[STOMP]: Circuit breaker open after ${MAX_RECONNECT_ATTEMPTS} consecutive failures — stopping reconnection. ` +
                'Reload the page to retry.',
            );
            return;
        }

        const baseDelay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
            MAX_RECONNECT_DELAY,
        );
        const delay = jitter(baseDelay);
        stompClient.reconnectDelay = delay;
        console.warn(
            `[STOMP]: WebSocket closed, next reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
        );
    },
    onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
    },
});

/**
 * Activates the STOMP client with an Auth0 JWT token.
 * Called by StompAuthHandler once the user is authenticated.
 */
export function activateWithToken(token: string): void {
    stompClient.connectHeaders = { Authorization: `Bearer ${token}` };
    if (!stompClient.active) {
        stompClient.activate();
    }
}