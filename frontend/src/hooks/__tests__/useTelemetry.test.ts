import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTelemetry } from '../useTelemetry';
import { stompClient } from '@/api/stompClient.ts';

vi.mock('../../api/stompClient', () => ({
    stompClient: {
        connected: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn()
    }
}));

describe('useTelemetry Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock requestAnimationFrame to be asynchronous (approx 60fps)
        // This breaks the synchronous infinite loop that causes the call stack to overflow.
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            return setTimeout(() => cb(0), 16) as unknown as number;
        });

        // Ensure we also clean it up so the test doesn't leak memory
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            clearTimeout(id);
        });
    });

    it('subscribes to stompClient and flushes buffer to callback', async () => {
        const mockCallback = vi.fn();
        let stompCallback: (message: { body: string }) => void = () => {};

        // Prefix 'topic' with an underscore to satisfy the unused variable rule
        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useTelemetry(mockCallback));

        // Wait for the setInterval connection check to clear
        await waitFor(() => {
            expect(stompClient.subscribe).toHaveBeenCalledWith('/topic/race-data', expect.any(Function));
        });

        // Simulate incoming STOMP message
        stompCallback({ body: JSON.stringify({ driver_number: 1, speed: 320 }) });

        // Assert callback received the data after the RAF flush
        await waitFor(() => {
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ speed: 320 }));
        });
    });

    it('keeps the latest packet for every driver in a burst, not just the last message', async () => {
        // The replay engine publishes a whole window for all drivers back-to-back,
        // so they land inside one rAF interval. Coalescing to the last *message*
        // used to discard every driver but one.
        const mockCallback = vi.fn();
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useTelemetry(mockCallback));
        await waitFor(() => expect(stompClient.subscribe).toHaveBeenCalled());

        stompCallback({ body: JSON.stringify({ driver_number: 1, speed: 300 }) });
        stompCallback({ body: JSON.stringify({ driver_number: 44, speed: 310 }) });
        stompCallback({ body: JSON.stringify({ driver_number: 1, speed: 305 }) });
        stompCallback({ body: JSON.stringify({ driver_number: 16, speed: 290 }) });

        await waitFor(() => expect(mockCallback).toHaveBeenCalledTimes(3));

        const delivered = mockCallback.mock.calls.map(([p]) => p);
        expect(delivered).toEqual(expect.arrayContaining([
            expect.objectContaining({ driver_number: 1, speed: 305 }),  // latest for #1
            expect.objectContaining({ driver_number: 44, speed: 310 }),
            expect.objectContaining({ driver_number: 16, speed: 290 }),
        ]));
        // ...and only the newest packet per driver: #1's 300 km/h reading is gone.
        expect(delivered).not.toContainEqual(expect.objectContaining({ speed: 300 }));
    });

    it('bounds the buffer to one entry per driver regardless of packet volume', async () => {
        const mockCallback = vi.fn();
        let stompCallback: (message: { body: string }) => void = () => {};

        vi.mocked(stompClient.subscribe).mockImplementation((_topic, cb) => {
            stompCallback = cb as typeof stompCallback;
            return { id: '1', unsubscribe: vi.fn() };
        });

        renderHook(() => useTelemetry(mockCallback));
        await waitFor(() => expect(stompClient.subscribe).toHaveBeenCalled());

        // 2000 packets across 20 drivers, as a hidden tab would accumulate.
        for (let i = 0; i < 2000; i++) {
            stompCallback({ body: JSON.stringify({ driver_number: i % 20, speed: i }) });
        }

        await waitFor(() => expect(mockCallback).toHaveBeenCalled());
        expect(mockCallback.mock.calls.length).toBeLessThanOrEqual(20);
    });
});
