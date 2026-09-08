import { Client, ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { MARK, mark } from '../lib/perf';
import { setConnectionStatus } from '../realtime/connectionStatus';

const log = createLogger('stomp');

// Reconnection budget.  The SockJS handshake (GET /ws/info) bypasses the Axios
// 429 interceptor, so every attempt consumes rate-limit budget; without a cap a
// client that can never connect hammers the gateway forever.
//
// Backoff is delegated to the library: `reconnectTimeMode: EXPONENTIAL` doubles
// the delay from `reconnectDelay` up to `maxReconnectDelay`.  Assigning to
// `stompClient.reconnectDelay` from a callback does NOT work — the library
// snapshots it into a private field in activate() and after CONNECT only.
const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;
// 5s+10s+20s+40s+60s ≈ 2 min of retrying before the breaker opens.
const MAX_RECONNECT_ATTEMPTS = 6;

let consecutiveFailures = 0;

/** Resolves a currently-valid access token. Registered by StompAuthHandler. */
export type StompTokenProvider = () => Promise<string>;
let tokenProvider: StompTokenProvider | null = null;

/**
 * Registers (or clears, with `null`) the provider consulted before every CONNECT.
 *
 * The broker validates `exp` on each CONNECT and Cloud Run recycles WebSockets at
 * its request timeout, so reconnects are routine.  Re-reading the token here — via
 * `getAccessTokenSilently`, which serves a refreshed token from the Auth0 cache —
 * is what stops a routine reconnect from becoming a permanent auth failure loop.
 */
export function setStompTokenProvider(provider: StompTokenProvider | null): void {
    tokenProvider = provider;
}

const DEBUG_ENABLED = import.meta.env.DEV || env.stompDebug;

/**
 * Frame logger. `FrameImpl.toString()` serialises every header, so the CONNECT
 * frame carries the bearer token — it is redacted here and the whole hook is a
 * no-op outside DEV, which Vite tree-shakes out of production builds.
 */
function stompDebug(message: string): void {
    if (!DEBUG_ENABLED) return;
    if (message.startsWith('>>> CONNECT')) {
        log.debug('>>> CONNECT (headers redacted)');
        return;
    }
    log.debug(message);
}

export const stompClient = new Client({
    // A native WebSocket, not SockJS.
    //
    // Every supported browser has had WebSocket for a decade; SockJS was buying
    // fallbacks nobody needs, at the cost of an unmaintained dependency, a
    // `global` shim in the Vite config, and an extra GET /ws/info handshake per
    // connection attempt that bypassed the Axios 429 interceptor and consumed
    // rate-limit budget on every reconnect.
    brokerURL: env.wsUrl,
    reconnectDelay: BASE_RECONNECT_DELAY,
    maxReconnectDelay: MAX_RECONNECT_DELAY,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    // setInterval heartbeats are throttled to ~1/min in hidden tabs, which trips
    // the broker's 10 s watchdog; a Worker ticker keeps running while backgrounded.
    heartbeatStrategy: TickerStrategy.Worker,
    // Outgoing matches the server's 10 s (WebSocketConfig.java:36); incoming is
    // given headroom so one delayed frame does not tear down a healthy socket.
    heartbeatIncoming: 15000,
    heartbeatOutgoing: 10000,
    debug: stompDebug,
    beforeConnect: async (client) => {
        setConnectionStatus(consecutiveFailures > 0 ? 'reconnecting' : 'connecting');
        if (!tokenProvider) return;
        try {
            const token = await tokenProvider();
            client.connectHeaders = { Authorization: `Bearer ${token}` };
        } catch (error) {
            // Retrying with no (or a dead) token just repeats the rejection.
            log.error('Could not acquire a token for CONNECT — stopping reconnection', error);
            setConnectionStatus('auth-rejected');
            void client.deactivate();
        }
    },
    onConnect: () => {
        consecutiveFailures = 0;
        setConnectionStatus('connected');
        // The clock for time-to-first-packet starts here, not at activate():
        // the interesting number is how long the broker takes to say something
        // after the socket is up, not how long the handshake took.
        mark(MARK.stompConnected);
    },
    onWebSocketClose: () => {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_RECONNECT_ATTEMPTS) {
            log.error(
                `Circuit breaker open after ${MAX_RECONNECT_ATTEMPTS} consecutive failures — reconnection stopped.`,
            );
            setConnectionStatus('circuit-open');
            // deactivate() is the documented way to stop reconnecting.
            void stompClient.deactivate();
            return;
        }
        setConnectionStatus('reconnecting');
    },
    onStompError: (frame) => {
        log.error('Broker reported an error', frame.headers.message);
        if (DEBUG_ENABLED) log.error('Broker error details', frame.body);
    },
});

/**
 * Activates the client if it is not already running. The token is fetched by
 * `beforeConnect`, so no token is passed in here.
 */
export function activateStomp(): void {
    if (!stompClient.active) {
        consecutiveFailures = 0;
        stompClient.activate();
    }
}

/** Clears the breaker and reconnects. Wired to the UI's retry affordance. */
export function retryStompConnection(): void {
    consecutiveFailures = 0;
    setConnectionStatus('idle');
    if (!stompClient.active) {
        stompClient.activate();
    }
}
