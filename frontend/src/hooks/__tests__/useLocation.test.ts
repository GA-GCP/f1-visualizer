import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stompClient } from '@/api/stompClient';
import { setConnectionStatus, resetConnectionStatus } from '@/realtime/connectionStatus';
import type { LocationPacket } from '@/types/telemetry';
import { useLocation } from '../useLocation';

vi.mock('../../api/stompClient', () => ({
    stompClient: {
        connected: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    },
}));

/** A complete wire-shaped location packet; packets are schema-validated now. */
const packet = (over: Partial<LocationPacket> = {}): LocationPacket => ({
    session_key: 9165,
    meeting_key: 1,
    date: '2024-05-01T12:00:00Z',
    driver_number: 1,
    x: 0,
    y: 0,
    z: 0,
    ...over,
});

/** Helper: creates a mutable ref acting as the location queue */
function makeQueueRef(): React.RefObject<LocationPacket[]> {
    return { current: [] };
}

describe('useLocation Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Subscription is driven by the client's published state now, not by a
        // 500 ms poller reading stompClient.connected.
        resetConnectionStatus();
        setConnectionStatus('connected');
    });

    it('subscribes to stompClient on /topic/race-location', async () => {
        vi.mocked(stompClient.subscribe).mockImplementation(() => {
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith(
                '/topic/race-location',
                expect.any(Function),
            );
        });
    });

    it('pushes ALL packets directly into the queue ref', async () => {
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));

        // Wait for the subscription to be established
        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith(
                '/topic/race-location',
                expect.any(Function),
            );
        });

        // Simulate multiple STOMP messages arriving
        const packet1 = {
            session_key: 1,
            meeting_key: 1,
            date: '2024-01-01',
            driver_number: 1,
            x: 100,
            y: 200,
            z: 0,
        };
        const packet2 = {
            session_key: 1,
            meeting_key: 1,
            date: '2024-01-01',
            driver_number: 1,
            x: 150,
            y: 250,
            z: 0,
        };
        const packet3 = {
            session_key: 1,
            meeting_key: 1,
            date: '2024-01-01',
            driver_number: 1,
            x: 200,
            y: 300,
            z: 0,
        };

        stompCallback({ body: JSON.stringify(packet1) });
        stompCallback({ body: JSON.stringify(packet2) });
        stompCallback({ body: JSON.stringify(packet3) });

        // All three packets should be in the queue immediately (no rAF needed)
        expect(queueRef.current).toHaveLength(3);
        expect(queueRef.current[0]).toEqual(expect.objectContaining({ x: 100, y: 200 }));
        expect(queueRef.current[1]).toEqual(expect.objectContaining({ x: 150, y: 250 }));
        expect(queueRef.current[2]).toEqual(expect.objectContaining({ x: 200, y: 300 }));
    });

    it('rejects packets with missing required fields', async () => {
        let stompCallback: (message: { body: string }) => void = () => {};
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalled();
        });

        // Send a packet missing required fields
        stompCallback({ body: JSON.stringify({ session_key: 1, meeting_key: 1 }) });

        // Should not be added to the queue
        expect(queueRef.current).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('did not match the expected shape'),
            expect.anything(),
        );

        consoleSpy.mockRestore();
    });

    it('handles double-encoded JSON (string-within-string) gracefully', async () => {
        let stompCallback: (message: { body: string }) => void = () => {};
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalled();
        });

        // Simulate double-encoded JSON (JSON.parse returns a string, not an object)
        const innerJson = JSON.stringify({
            session_key: 1,
            driver_number: 1,
            x: 100,
            y: 200,
            z: 0,
        });
        stompCallback({ body: JSON.stringify(innerJson) });

        // Should NOT be added to queue (it's a string, not an object)
        expect(queueRef.current).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('did not match the expected shape'),
            expect.anything(),
        );

        consoleSpy.mockRestore();
    });

    it('unsubscribes on unmount', async () => {
        const mockUnsubscribe = vi.fn();

        vi.mocked(stompClient.subscribe).mockImplementation(() => {
            return { id: '1', unsubscribe: mockUnsubscribe };
        });

        const queueRef = makeQueueRef();
        const { unmount } = renderHook(() => useLocation(queueRef));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalled();
        });

        unmount();

        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('caps the queue so a hidden tab cannot grow it without bound', async () => {
        let stompCallback: (message: { body: string }) => void = () => {};
        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));
        await waitFor(() => expect(stompClient.subscribe).toHaveBeenCalled());

        // rAF is paused in a background tab; the socket is not.
        for (let i = 0; i < 6000; i++) {
            stompCallback({ body: JSON.stringify(packet({ driver_number: 1, x: i, y: i })) });
        }

        expect(queueRef.current.length).toBe(5000);
        // The oldest points are the ones dropped — the newest must survive.
        expect(queueRef.current[queueRef.current.length - 1]).toMatchObject({ x: 5999 });
        expect(queueRef.current[0]).toMatchObject({ x: 1000 });
    });

    it('coalesces to the newest point per driver when the tab is hidden', async () => {
        let stompCallback: (message: { body: string }) => void = () => {};
        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));
        await waitFor(() => expect(stompClient.subscribe).toHaveBeenCalled());

        for (let i = 0; i < 100; i++) {
            stompCallback({ body: JSON.stringify(packet({ driver_number: 1, x: i, y: i })) });
            stompCallback({ body: JSON.stringify(packet({ driver_number: 44, x: i * 2, y: i })) });
        }
        expect(queueRef.current.length).toBe(200);

        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // One position per car, so the first frame back is O(drivers) not O(queue).
        expect(queueRef.current).toHaveLength(2);
        expect(queueRef.current).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ driver_number: 1, x: 99 }),
                expect.objectContaining({ driver_number: 44, x: 198 }),
            ]),
        );

        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            configurable: true,
        });
    });

    // ── P1: one message per channel per tick ──

    it('queues every point in a batched message', async () => {
        const queueRef = makeQueueRef();
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useLocation(queueRef));

        stompCallback({
            body: JSON.stringify([
                packet({ driver_number: 1, x: 10 }),
                packet({ driver_number: 44, x: 20 }),
                packet({ driver_number: 16, x: 30 }),
            ]),
        });

        await waitFor(() => expect(queueRef.current).toHaveLength(3));
        expect(queueRef.current.map((p) => p.x)).toEqual([10, 20, 30]);
    });

    it('keeps the rest of a batch when one point is malformed', async () => {
        const queueRef = makeQueueRef();
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useLocation(queueRef));

        stompCallback({
            body: JSON.stringify([
                packet({ driver_number: 1 }),
                { x: 'left a bit' },
                packet({ driver_number: 44 }),
            ]),
        });

        await waitFor(() => expect(queueRef.current).toHaveLength(2));
    });
});
