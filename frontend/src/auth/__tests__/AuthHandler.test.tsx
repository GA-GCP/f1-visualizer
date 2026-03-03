import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosAuthInterceptor } from '../AuthHandler';
import { apiClient } from '@/api/apiClient.ts';

// Mock @auth0/auth0-react
const mockGetAccessTokenSilently = vi.fn();

vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn()
}));

// Mock apiClient
vi.mock('../../api/apiClient', () => ({
    apiClient: {
        interceptors: {
            request: {
                use: vi.fn().mockReturnValue(42),
                eject: vi.fn()
            }
        }
    }
}));

// Import useAuth0 so we can control its mock return value
import { useAuth0 } from '@auth0/auth0-react';

describe('AxiosAuthInterceptor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers axios request interceptor when authenticated', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('mock-auth-token');

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true
        });

        render(<AxiosAuthInterceptor />);

        // Verify the interceptor was registered
        expect(apiClient.interceptors.request.use).toHaveBeenCalledTimes(1);
        expect(apiClient.interceptors.request.use).toHaveBeenCalledWith(expect.any(Function));

        // Extract the interceptor function and test it injects the token
        const interceptorFn = vi.mocked(apiClient.interceptors.request.use).mock.calls[0][0] as (config: { headers: Record<string, string> }) => Promise<{ headers: Record<string, string> }>;
        const mockConfig = { headers: {} as Record<string, string> };

        const resultConfig = await interceptorFn(mockConfig);

        expect(mockGetAccessTokenSilently).toHaveBeenCalled();
        expect(resultConfig.headers.Authorization).toBe('Bearer mock-auth-token');
    });

    it('does not inject token when not authenticated', async () => {
        mockGetAccessTokenSilently.mockResolvedValue('mock-auth-token');

        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: false
        });

        render(<AxiosAuthInterceptor />);

        // Interceptor is still registered (it's always registered)
        expect(apiClient.interceptors.request.use).toHaveBeenCalledTimes(1);

        // Extract the interceptor function and verify it does NOT inject the token
        const interceptorFn = vi.mocked(apiClient.interceptors.request.use).mock.calls[0][0] as (config: { headers: Record<string, string> }) => Promise<{ headers: Record<string, string> }>;
        const mockConfig = { headers: {} as Record<string, string> };

        const resultConfig = await interceptorFn(mockConfig);

        // Token should NOT be injected because isAuthenticated is false
        expect(mockGetAccessTokenSilently).not.toHaveBeenCalled();
        expect(resultConfig.headers.Authorization).toBeUndefined();
    });

    it('ejects interceptor on unmount', () => {
        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            getAccessTokenSilently: mockGetAccessTokenSilently,
            isAuthenticated: true
        });

        const { unmount } = render(<AxiosAuthInterceptor />);

        unmount();

        // Verify the interceptor was ejected with the ID returned by use()
        expect(apiClient.interceptors.request.eject).toHaveBeenCalledWith(42);
    });
});
