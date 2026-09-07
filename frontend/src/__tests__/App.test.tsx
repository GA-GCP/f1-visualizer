import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@auth0/auth0-react', () => ({ useAuth0: vi.fn() }));
vi.mock('../api/referenceApi', () => ({
    fetchDrivers: vi.fn().mockResolvedValue([]),
    fetchSessions: vi.fn().mockResolvedValue([]),
}));
// Stubbed so these tests are about the route tree and the auth guard, not about
// what each page fetches on mount.
vi.mock('../context/UserContext', () => ({
    UserProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useUser: () => ({ userProfile: null, isLoading: false }),
}));
vi.mock('../components/layout/LayoutMain', async () => {
    const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { default: () => <Outlet /> };
});
vi.mock('../components/splash/SplashScreen', () => ({
    default: () => <div data-testid="splash" />,
}));
vi.mock('../auth/StompAuthHandler', () => ({
    StompAuthHandler: () => <div data-testid="stomp-handler" />,
}));
vi.mock('../pages/Home', () => ({ default: () => <div data-testid="page-home" /> }));
vi.mock('../pages/HistoricalData', () => ({ default: () => <div data-testid="page-historical" /> }));
vi.mock('../pages/VersusMode', () => ({ default: () => <div data-testid="page-versus" /> }));

import { useAuth0 } from '@auth0/auth0-react';
import { fetchDrivers, fetchSessions } from '../api/referenceApi';
import { AppRoutes } from '../App';
import { broadcastTheme } from '../theme/theme';

type Auth0State = {
    isAuthenticated?: boolean;
    isLoading?: boolean;
    error?: Error;
};

const mockAuth0 = ({ isAuthenticated = false, isLoading = false, error }: Auth0State) => {
    (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        isAuthenticated,
        isLoading,
        error,
        loginWithRedirect: vi.fn(),
        getAccessTokenSilently: vi.fn(),
    });
};

const renderAt = (path: string) =>
    render(
        <ThemeProvider theme={broadcastTheme}>
            <MemoryRouter initialEntries={[path]}>
                <AppRoutes />
            </MemoryRouter>
        </ThemeProvider>,
    );

describe('AppRoutes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('the public landing route', () => {
        it('paints the landing page without waiting for Auth0', () => {
            // Auth0's isLoading gates *protected* content. Blocking on it here
            // held a blank screen for a checkSession() round-trip on the only
            // public page.
            mockAuth0({ isLoading: true, isAuthenticated: false });

            renderAt('/');

            expect(screen.getByRole('button', { name: /login or sign up/i })).toBeInTheDocument();
        });

        it('sends an already-authenticated visitor to the dashboard', async () => {
            mockAuth0({ isAuthenticated: true });

            renderAt('/');

            // The shell and the page are lazy chunks, so they resolve a tick later.
            expect(await screen.findByTestId('page-home')).toBeInTheDocument();
        });
    });

    describe('the auth guard', () => {
        it('redirects an unauthenticated visitor from /dashboard to the landing page', () => {
            mockAuth0({ isAuthenticated: false });

            renderAt('/dashboard');

            expect(screen.queryByTestId('page-home')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /login or sign up/i })).toBeInTheDocument();
        });

        it('renders nothing while the session is still resolving', () => {
            mockAuth0({ isLoading: true, isAuthenticated: false });

            const { container } = renderAt('/historical');

            expect(container).toBeEmptyDOMElement();
        });

        it('surfaces an Auth0 error instead of the protected page', () => {
            mockAuth0({ error: new Error('Invalid state'), isAuthenticated: false });

            renderAt('/dashboard');

            expect(screen.getByRole('heading', { name: /authentication error/i })).toBeInTheDocument();
            expect(screen.queryByTestId('page-home')).not.toBeInTheDocument();
        });

        it.each([
            ['/dashboard', 'page-home'],
            ['/historical', 'page-historical'],
            ['/versus', 'page-versus'],
        ])('renders %s for an authenticated user', async (path, testId) => {
            mockAuth0({ isAuthenticated: true });

            renderAt(path);

            expect(await screen.findByTestId(testId)).toBeInTheDocument();
        });
    });

    describe('code splitting', () => {
        it('keeps the WebSocket stack off the public route', async () => {
            // StompAuthHandler is dynamically imported and mounted under the auth
            // guard. Mounting it at the app root put the whole STOMP + SockJS
            // stack in the chunk the landing page downloads before login.
            mockAuth0({ isAuthenticated: false });

            renderAt('/');

            expect(screen.getByRole('button', { name: /login or sign up/i })).toBeInTheDocument();
            expect(screen.queryByTestId('stomp-handler')).not.toBeInTheDocument();
        });

        it('mounts the WebSocket stack once past the guard', async () => {
            mockAuth0({ isAuthenticated: true });

            renderAt('/dashboard');

            expect(await screen.findByTestId('stomp-handler')).toBeInTheDocument();
        });
    });

    describe('the post-login splash', () => {
        it('shows the splash, prefetches, and clears the one-shot flag', async () => {
            vi.useFakeTimers();
            sessionStorage.setItem('f1v:post-login', '1');
            mockAuth0({ isAuthenticated: true });

            renderAt('/dashboard');

            expect(screen.getByTestId('splash')).toBeInTheDocument();
            expect(screen.queryByTestId('page-home')).not.toBeInTheDocument();
            expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();
            // The flag is a one-shot: a later mount must not re-show the splash.
            expect(sessionStorage.getItem('f1v:post-login')).toBeNull();

            // Prefetch is staggered so the two calls do not trip the gateway's
            // rate limiter with a simultaneous preflight burst.
            expect(fetchDrivers).toHaveBeenCalledTimes(1);
            expect(fetchSessions).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(400);
            expect(fetchSessions).toHaveBeenCalledTimes(1);
        });

        it('goes straight to the page when the flag is absent', async () => {
            mockAuth0({ isAuthenticated: true });

            renderAt('/dashboard');

            await waitFor(() => expect(screen.getByTestId('page-home')).toBeInTheDocument());
            expect(screen.queryByTestId('splash')).not.toBeInTheDocument();
            expect(fetchDrivers).not.toHaveBeenCalled();
        });
    });
});
