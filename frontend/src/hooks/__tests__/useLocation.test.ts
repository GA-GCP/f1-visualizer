import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useLocation } from '../useLocation';
import { stompClient } from '@/api/stompClient.ts';
import type { LocationPacket } from '@/types/telemetry.ts';

vi.mock('../../api/stompClient', () => ({
    stompClient: {
        connected: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn()
    }
}));

/** Helper: creates a mutable ref acting as the location queue */
function makeQueueRef(): React.RefObject<LocationPacket[]> {
    return { current: [] };
}

describe('useLocation Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subscribes to stompClient on /topic/race-location', async () => {
        vi.mocked(stompClient.subscribe).mockImplementation(() => {
            return { id: '1', unsubscribe: vi.fn() };
        });

        const queueRef = makeQueueRef();
        renderHook(() => useLocation(queueRef));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith('/topic/race-location', expect.any(Function));
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
            expect(stompClient.subscribe).toHaveBeenCalledWith('/topic/race-location', expect.any(Function));
        });

        // Simulate multiple STOMP messages arriving
        const packet1 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 100, y: 200, z: 0 };
        const packet2 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 150, y: 250, z: 0 };
        const packet3 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 200, y: 300, z: 0 };

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
            expect.stringContaining('[GPS] Payload missing required fields'),
            expect.anything()
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
        const innerJson = JSON.stringify({ session_key: 1, driver_number: 1, x: 100, y: 200, z: 0 });
        stompCallback({ body: JSON.stringify(innerJson) });

        // Should NOT be added to queue (it's a string, not an object)
        expect(queueRef.current).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[GPS] Parsed payload is not an object'),
            expect.anything(),
            expect.anything()
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
});
