import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Client, StompConfig } from '@stomp/stompjs';

// Mock @stomp/stompjs before any imports.
// A real class is used so `new Client(...)` works (arrow fns aren't constructable),
// and the constructor copies the config onto the instance so the tests can assert
// the options we hand the library instead of the fields we used to mutate.
vi.mock('@stomp/stompjs', () => {
    class MockClient {
        connectHeaders: Record<string, string> = {};
        active = false;
        connected = false;
        activate = vi.fn();
        deactivate = vi.fn().mockResolvedValue(undefined);
        subscribe = vi.fn();
        constructor(conf: StompConfig) {
            Object.assign(this, conf);
        }
    }
    return {
        Client: MockClient,
        ReconnectionTimeMode: { LINEAR: 0, EXPONENTIAL: 1 },
        TickerStrategy: { Interval: 'interval', Worker: 'worker' },
    };
});

/** Freshly import the client plus the status store it publishes into. */
async function loadStomp() {
    const mod = await import('../stompClient');
    const status = await import('../../realtime/connectionStatus');
    // The mock copies config onto the instance, so the hooks are readable here.
    const client = mod.stompClient as Client & StompConfig;
    return { ...mod, client, ...status };
}

describe('stompClient', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('reconnection is delegated to the library', () => {
        it('connects with a native WebSocket, not SockJS', async () => {
            const { client } = await loadStomp();

            // SockJS added an unmaintained dependency, a `global` shim, and a
            // GET /ws/info handshake per attempt that bypassed the 429
            // interceptor and burned rate-limit budget on every reconnect.
            expect(client.brokerURL).toMatch(/^wss?:\/\/.*\/ws\/websocket$/);
            expect(client.webSocketFactory).toBeUndefined();
        });

        it('configures truncated exponential backoff rather than a hand-rolled ladder', async () => {
            const { client } = await loadStomp();

            expect(client.reconnectDelay).toBe(5000);
            expect(client.maxReconnectDelay).toBe(60000);
            // ReconnectionTimeMode.EXPONENTIAL
            expect(client.reconnectTimeMode).toBe(1);
        });

        it('uses a Worker ticker so heartbeats survive background-tab throttling', async () => {
            const { client } = await loadStomp();

            expect(client.heartbeatStrategy).toBe('worker');
            // Server sends/expects 10s (WebSocketConfig.java:36); incoming has headroom.
            expect(client.heartbeatOutgoing).toBe(10000);
            expect(client.heartbeatIncoming).toBe(15000);
        });
    });

    describe('circuit breaker', () => {
        it('deactivates the client after six consecutive socket closes', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, getConnectionStatus } = await loadStomp();

            for (let i = 0; i < 5; i++) client.onWebSocketClose?.(new CloseEvent('close'));
            expect(client.deactivate).not.toHaveBeenCalled();
            expect(getConnectionStatus()).toBe('reconnecting');

            client.onWebSocketClose?.(new CloseEvent('close'));

            expect(client.deactivate).toHaveBeenCalledTimes(1);
            expect(getConnectionStatus()).toBe('circuit-open');
        });

        it('resets the failure count on a successful connect', async () => {
            const { client, getConnectionStatus } = await loadStomp();

            for (let i = 0; i < 5; i++) client.onWebSocketClose?.(new CloseEvent('close'));
            client.onConnect?.({ command: 'CONNECTED', headers: {}, body: '', binaryBody: new Uint8Array(), isBinaryBody: false });
            expect(getConnectionStatus()).toBe('connected');

            // The budget is full again, so five more closes must not open the breaker.
            for (let i = 0; i < 5; i++) client.onWebSocketClose?.(new CloseEvent('close'));
            expect(client.deactivate).not.toHaveBeenCalled();
        });

        it('retryStompConnection clears the breaker and reactivates', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, retryStompConnection, getConnectionStatus } = await loadStomp();

            for (let i = 0; i < 6; i++) client.onWebSocketClose?.(new CloseEvent('close'));
            expect(getConnectionStatus()).toBe('circuit-open');

            retryStompConnection();

            expect(client.activate).toHaveBeenCalledTimes(1);
            expect(getConnectionStatus()).toBe('idle');
        });
    });

    describe('token acquisition', () => {
        it('beforeConnect asks the provider for a fresh token on every CONNECT', async () => {
            const { client, setStompTokenProvider } = await loadStomp();
            const provider = vi.fn()
                .mockResolvedValueOnce('token-1')
                .mockResolvedValueOnce('token-2');
            setStompTokenProvider(provider);

            await client.beforeConnect?.(client);
            expect(client.connectHeaders).toEqual({ Authorization: 'Bearer token-1' });

            await client.beforeConnect?.(client);
            expect(client.connectHeaders).toEqual({ Authorization: 'Bearer token-2' });
            expect(provider).toHaveBeenCalledTimes(2);
        });

        it('stops reconnecting when a token cannot be acquired', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const { client, setStompTokenProvider, getConnectionStatus } = await loadStomp();
            setStompTokenProvider(() => Promise.reject(new Error('login_required')));

            await client.beforeConnect?.(client);

            expect(getConnectionStatus()).toBe('auth-rejected');
            expect(client.deactivate).toHaveBeenCalledTimes(1);
            expect(client.connectHeaders).toEqual({});
        });

        it('leaves headers alone when no provider is registered', async () => {
            const { client, setStompTokenProvider } = await loadStomp();
            setStompTokenProvider(null);

            await client.beforeConnect?.(client);

            expect(client.connectHeaders).toEqual({});
        });

        it('activateStomp does not double-activate', async () => {
            const { client, activateStomp } = await loadStomp();

            activateStomp();
            expect(client.activate).toHaveBeenCalledTimes(1);

            Object.defineProperty(client, 'active', { value: true, writable: true });
            activateStomp();
            expect(client.activate).toHaveBeenCalledTimes(1);
        });
    });

    describe('debug logging', () => {
        it('redacts the CONNECT frame, which carries the bearer token', async () => {
            const log = vi.spyOn(console, 'debug').mockImplementation(() => {});
            const { client } = await loadStomp();

            client.debug?.('>>> CONNECT\nAuthorization:Bearer super-secret-jwt');

            expect(log).toHaveBeenCalledWith('[stomp] >>> CONNECT (headers redacted)');
            expect(log.mock.calls.flat().join(' ')).not.toContain('super-secret-jwt');
        });

        it('passes other frames through', async () => {
            const log = vi.spyOn(console, 'debug').mockImplementation(() => {});
            const { client } = await loadStomp();

            client.debug?.('<<< CONNECTED');

            expect(log).toHaveBeenCalledWith('[stomp] <<< CONNECTED');
        });
    });
});
