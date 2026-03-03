import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocation } from '../useLocation';
import { stompClient } from '@/api/stompClient.ts';

vi.mock('../../api/stompClient', () => ({
    stompClient: {
        connected: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn()
    }
}));

describe('useLocation Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock requestAnimationFrame to be asynchronous (approx 60fps)
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            return setTimeout(() => cb(0), 16) as unknown as number;
        });

        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            clearTimeout(id);
        });
    });

    it('subscribes to stompClient on /topic/race-location', async () => {
        const mockCallback = vi.fn();

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, _cb) => {
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useLocation(mockCallback));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith('/topic/race-location', expect.any(Function));
        });
    });

    it('flushes ALL buffered packets to callback (not just latest)', async () => {
        const mockCallback = vi.fn();
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useLocation(mockCallback));

        // Wait for the subscription to be established
        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith('/topic/race-location', expect.any(Function));
        });

        // Simulate multiple STOMP messages arriving before the next RAF flush
        const packet1 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 100, y: 200, z: 0 };
        const packet2 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 150, y: 250, z: 0 };
        const packet3 = { session_key: 1, meeting_key: 1, date: '2024-01-01', driver_number: 1, x: 200, y: 300, z: 0 };

        stompCallback({ body: JSON.stringify(packet1) });
        stompCallback({ body: JSON.stringify(packet2) });
        stompCallback({ body: JSON.stringify(packet3) });

        // Assert the callback was called once for EACH packet (not just the latest)
        await waitFor(() => {
            expect(mockCallback).toHaveBeenCalledTimes(3);
        });

        expect(mockCallback).toHaveBeenNthCalledWith(1, expect.objectContaining({ x: 100, y: 200 }));
        expect(mockCallback).toHaveBeenNthCalledWith(2, expect.objectContaining({ x: 150, y: 250 }));
        expect(mockCallback).toHaveBeenNthCalledWith(3, expect.objectContaining({ x: 200, y: 300 }));
    });

    it('unsubscribes and cancels animation frame on unmount', async () => {
        const mockCallback = vi.fn();
        const mockUnsubscribe = vi.fn();

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, _cb) => {
            return { id: '1', unsubscribe: mockUnsubscribe };
        });

        const { unmount } = renderHook(() => useLocation(mockCallback));

        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalled();
        });

        unmount();

        expect(mockUnsubscribe).toHaveBeenCalled();
    });
});
