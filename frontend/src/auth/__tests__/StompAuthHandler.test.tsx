import { useAuth0 } from '@auth0/auth0-react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetAccessTokenSilently = vi.fn();
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn(),
}));

vi.mock('../../api/stompClient', () => ({
    activateStomp: vi.fn(),
    setStompTokenProvider: vi.fn(),
    stompClient: { active: false, deactivate: vi.fn() },
}));

import { activateStomp, setStompTokenProvider, stompClient } from '../../api/stompClient';
import { StompAuthHandler } from '../StompAuthHandler';

const mockUseAuth0 = (isAuthenticated: boolean) => {
    (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        getAccessTokenSilently: mockGetAccessTokenSilently,
        isAuthenticated,
    });
};

describe('StompAuthHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        Object.defineProperty(stompClient, 'active', { value: false, writable: true, configurable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing (returns null)', () => {
        mockUseAuth0(false);

        const { container } = render(<StompAuthHandler />);

        expect(container.innerHTML).toBe('');
    });

    it('does not touch STOMP when the user is not authenticated', () => {
        mockUseAuth0(false);

        render(<StompAuthHandler />);

        expect(setStompTokenProvider).not.toHaveBeenCalled();
        expect(activateStomp).not.toHaveBeenCalled();
    });

    it('registers a token provider immediately and activates after the stagger delay', async () => {
        mockUseAuth0(true);

        render(<StompAuthHandler />);

        // The provider must be in place before the first CONNECT is attempted.
        expect(setStompTokenProvider).toHaveBeenCalledTimes(1);
        expect(activateStomp).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(2000);
        expect(activateStomp).toHaveBeenCalledTimes(1);
    });

    it('registers a provider that delegates to getAccessTokenSilently on every call', async () => {
        mockGetAccessTokenSilently
            .mockResolvedValueOnce('first-token')
            .mockResolvedValueOnce('second-token');
        mockUseAuth0(true);

        render(<StompAuthHandler />);

        const provider = (setStompTokenProvider as unknown as ReturnType<typeof vi.fn>)
            .mock.calls[0][0] as () => Promise<string>;

        // A reconnect calls the provider again and must get a freshly-issued token.
        await expect(provider()).resolves.toBe('first-token');
        await expect(provider()).resolves.toBe('second-token');
        expect(mockGetAccessTokenSilently).toHaveBeenCalledTimes(2);
    });

    it('clears the provider and deactivates STOMP on unmount when active', () => {
        Object.defineProperty(stompClient, 'active', { value: true, writable: true, configurable: true });
        mockUseAuth0(true);

        const { unmount } = render(<StompAuthHandler />);
        unmount();

        expect(setStompTokenProvider).toHaveBeenLastCalledWith(null);
        expect(stompClient.deactivate).toHaveBeenCalled();
    });

    it('does not activate if unmounted before the stagger delay completes', async () => {
        mockUseAuth0(true);

        const { unmount } = render(<StompAuthHandler />);
        unmount();
        await vi.advanceTimersByTimeAsync(2000);

        expect(activateStomp).not.toHaveBeenCalled();
    });
});
