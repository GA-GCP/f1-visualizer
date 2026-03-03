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
});