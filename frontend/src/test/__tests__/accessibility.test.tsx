import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { fetchSessionLaps, fetchSessions, fetchYears } from '../../api/referenceApi';

vi.mock('@auth0/auth0-react', () => ({
    useAuth0: () => ({
        loginWithRedirect: vi.fn(),
        logout: vi.fn(),
        isAuthenticated: true,
        getAccessTokenSilently: vi.fn(),
    }),
}));

vi.mock('../../api/referenceApi', () => ({
    fetchDrivers: vi.fn().mockResolvedValue([]),
    fetchSessions: vi.fn().mockResolvedValue([]),
    fetchSessionLaps: vi.fn().mockResolvedValue([]),
    fetchSessionDrivers: vi.fn().mockResolvedValue({ sessionKey: 1, year: 2024, drivers: [] }),
    fetchDriverStats: vi.fn().mockResolvedValue({}),
    fetchYears: vi.fn().mockResolvedValue([]),
    fetchSessionsByYear: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../context/UserContext', () => ({
    UserProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useUser: () => ({ userProfile: null, isLoading: false, updatePreferences: vi.fn() }),
}));

import LayoutMain from '../../components/layout/LayoutMain';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import HistoricalData from '../../pages/HistoricalData';
import Landing from '../../pages/Landing';
import { renderWithTheme } from '../renderWithTheme';

/**
 * axe assertions over the real theme.
 *
 * There was no accessibility test layer at all, so none of the findings this
 * branch fixes would have been caught — or stay fixed — without one.
 */
describe('accessibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks clears recorded calls but keeps implementations, so a
        // mockReturnValue set inside one test leaks into the next. Re-declared
        // here so every test starts from the same place no matter what ran
        // before it.
        vi.mocked(fetchYears).mockResolvedValue([]);
        vi.mocked(fetchSessions).mockResolvedValue([]);
        vi.mocked(fetchSessionLaps).mockResolvedValue([]);
    });

    it('the public landing page has no violations', async () => {
        const { container } = renderWithTheme(<Landing />);

        expect(await axe(container)).toHaveNoViolations();
    });

    it('the app shell has no violations', async () => {
        const { container } = renderWithTheme(<LayoutMain />, { route: '/dashboard' });

        expect(await axe(container)).toHaveNoViolations();
    });

    it('the data vault has no violations while loading', async () => {
        // Asserted separately from the settled state: whichever one the timing
        // happened to catch used to decide what this test checked, which is how
        // a heading-order violation in the loader went unnoticed.
        //
        // The fetchers never settle here, deliberately. With the default
        // mockResolvedValue the queries resolved *after* this test returned and
        // updated a component that had not unmounted yet, which React reports
        // as an update outside act — now fatal, which is how it was found. A
        // loading-state test whose data arrives is not testing a loading state.
        vi.mocked(fetchYears).mockReturnValue(new Promise(() => {}));
        vi.mocked(fetchSessions).mockReturnValue(new Promise(() => {}));

        const { container } = renderWithTheme(<HistoricalData />, { route: '/historical' });

        expect(await axe(container)).toHaveNoViolations();
    });

    it('the data vault has no violations once loaded', async () => {
        const { container, findByText } = renderWithTheme(<HistoricalData />, {
            route: '/historical',
        });
        await findByText(/no lap data for this session/i);

        expect(await axe(container)).toHaveNoViolations();
    });

    it('the shared failure states have no violations', async () => {
        const { container } = renderWithTheme(
            <>
                <ErrorState onRetry={vi.fn()} />
                <EmptyState title="Nothing here" message="Try another session." />
            </>,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});

describe('the app shell landmarks', () => {
    it('exposes a navigation landmark, a main landmark and a skip link', () => {
        // Content lived in generic divs, so there was nothing to skip to and no
        // way to jump between regions.
        const { getByRole } = renderWithTheme(<LayoutMain />, { route: '/dashboard' });

        expect(getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
        expect(getByRole('main')).toBeInTheDocument();
        expect(getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
    });

    it('marks the current route, which colour alone did not convey', () => {
        const { getByRole } = renderWithTheme(<LayoutMain />, { route: '/historical' });

        expect(getByRole('link', { name: /data vault/i })).toHaveAttribute('aria-current', 'page');
        expect(getByRole('link', { name: /live console/i })).not.toHaveAttribute('aria-current');
    });

    it('names the icon-only header controls', () => {
        const { getByRole } = renderWithTheme(<LayoutMain />, { route: '/dashboard' });

        expect(getByRole('button', { name: /user preferences/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
});
