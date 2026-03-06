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

// Exponential backoff for STOMP reconnection.
// The SockJS handshake (GET /ws/info) bypasses the Axios 429 interceptor,
// so a fixed 5s reconnectDelay hammers the rate limiter forever once 429s start.
// Backoff gives the server time to clear the rate-limit window.
const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;
let reconnectAttempts = 0;

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
        const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
            MAX_RECONNECT_DELAY,
        );
        stompClient.reconnectDelay = delay;
        console.warn(`[STOMP]: WebSocket closed, next reconnect in ${delay / 1000}s (attempt ${reconnectAttempts})`);
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