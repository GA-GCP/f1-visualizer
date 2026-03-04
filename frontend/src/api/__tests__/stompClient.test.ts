import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @stomp/stompjs before any imports
// Uses a real class so `new Client(...)` works in Vitest 4 (arrow fns aren't constructable)
vi.mock('@stomp/stompjs', () => {
    class MockClient {
        connectHeaders: Record<string, string> = {};
        active = false;
        connected = false;
        activate = vi.fn();
        subscribe = vi.fn();
        webSocketFactory = null;
        reconnectDelay = 0;
        heartbeatIncoming = 0;
        heartbeatOutgoing = 0;
        debug = vi.fn();
        onStompError = vi.fn();
        constructor() {}
    }
    return { Client: MockClient };
});

// Mock sockjs-client
vi.mock('sockjs-client', () => ({
    default: vi.fn()
}));

describe('stompClient', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('activateWithToken sets connectHeaders and activates client', async () => {
        const { stompClient, activateWithToken } = await import('../stompClient');

        // Client starts inactive
        Object.defineProperty(stompClient, 'active', { value: false, writable: true });

        activateWithToken('my-jwt-token');

        expect(stompClient.connectHeaders).toEqual({
            Authorization: 'Bearer my-jwt-token'
        });
        expect(stompClient.activate).toHaveBeenCalledTimes(1);
    });

    it('does not double-activate if already active', async () => {
        const { stompClient, activateWithToken } = await import('../stompClient');

        // Simulate that the client is already active
        Object.defineProperty(stompClient, 'active', { value: true, writable: true });

        activateWithToken('my-jwt-token');

        // Headers should still be set
        expect(stompClient.connectHeaders).toEqual({
            Authorization: 'Bearer my-jwt-token'
        });
        // But activate() should NOT be called since the client is already active
        expect(stompClient.activate).not.toHaveBeenCalled();
    });
});
