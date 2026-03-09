import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @auth0/auth0-react
const mockGetAccessTokenSilently = vi.fn();
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn(),
}));

// Mock stompClient module
vi.mock('../../api/stompClient', () => ({
    activateWithToken: vi.fn(),
    stompClient: { active: false, deactivate: vi.fn() },
}));

import { useAuth0 } from '@auth0/auth0-react';
import { activateWithToken, stompClient } from '../../api/stompClient';
import { StompAuthHandler } from '../StompAuthHandler';

describe('StompAuthHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Reset stompClient.active
        Object.defineProperty(stompClient, 'active', { value: false, writable: true, configurable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing (returns null)', () => {
        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: false,
        });

        const { container } = render(<StompAuthHandler />);

        expect(container.innerHTML).toBe('');
    });

    it('does not activate STOMP when user is not authenticated', () => {
        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: false,
        });

        render(<StompAuthHandler />);

        expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
        expect(activateWithToken).not.toHaveBeenCalled();
    });

    it('acquires token and activates STOMP after delay when authenticated', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('test-jwt-token');

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(<StompAuthHandler />);

        // Token acquisition is async
        await vi.advanceTimersByTimeAsync(0);
        expect(mockGetAccessTokenSilently).toHaveBeenCalledTimes(1);

        // STOMP activation happens after a 2000ms delay
        expect(activateWithToken).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2000);
        expect(activateWithToken).toHaveBeenCalledWith('test-jwt-token');
    });

    it('deactivates STOMP on unmount when active', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('test-jwt-token');
        Object.defineProperty(stompClient, 'active', { value: true, writable: true, configurable: true });

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true,
        });

        const { unmount } = render(<StompAuthHandler />);
        unmount();

        expect(stompClient.deactivate).toHaveBeenCalled();
    });

    it('does not activate if unmounted before delay completes', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('test-jwt-token');

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true,
        });

        const { unmount } = render(<StompAuthHandler />);

        // Token acquired but unmount before the 2000ms delay
        await vi.advanceTimersByTimeAsync(0);
        unmount();
        await vi.advanceTimersByTimeAsync(2000);

        expect(activateWithToken).not.toHaveBeenCalled();
    });

    it('logs error when token acquisition fails', async () => {
        const error = new Error('Token refresh failed');
        mockGetAccessTokenSilently.mockRejectedValue(error);

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true,
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<StompAuthHandler />);
        await vi.advanceTimersByTimeAsync(0);

        expect(consoleSpy).toHaveBeenCalledWith(
            '[STOMP] Failed to acquire Auth0 token for WebSocket',
            error,
        );
        expect(activateWithToken).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
