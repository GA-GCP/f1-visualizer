import { useAuth0 } from '@auth0/auth0-react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import Landing from '../Landing';

// Mock @auth0/auth0-react
const mockLoginWithRedirect = vi.fn();
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn(),
}));

// Mock splash sub-components
vi.mock('../../components/splash/SplashBackground', () => ({
    default: () => <div data-testid="splash-background" />,
}));

vi.mock('../../components/splash/SplashCircuit', () => ({
    default: ({ continuous }: { continuous?: boolean }) => (
        <div data-testid="splash-circuit" data-continuous={continuous} />
    ),
}));

describe('Landing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            loginWithRedirect: mockLoginWithRedirect,
        });
    });

    it('renders the F1 VISUALIZER title letters', () => {
        renderWithProviders(<Landing />);

        // By heading role. getByText('F') collides with the first 'F' anywhere
        // on the page and says nothing about the title being a title.
        expect(
            screen.getByRole('heading', { level: 1, name: /f1 visualizer/i }),
        ).toBeInTheDocument();
        expect(screen.getByText('V')).toBeInTheDocument();
    });

    it('renders the tagline', () => {
        renderWithProviders(<Landing />);

        expect(
            screen.getByText('REAL-TIME TELEMETRY // HISTORICAL ANALYSIS // DRIVER COMPARISON'),
        ).toBeInTheDocument();
    });

    it('renders the login button', () => {
        renderWithProviders(<Landing />);

        expect(screen.getByText('Login or Sign Up For An Account')).toBeInTheDocument();
    });

    it('carries a deep link through the login round trip', () => {
        // RequiredAuth puts the path the user actually asked for into the
        // navigation state when it bounces them here. Without passing it to
        // Auth0 as appState it is lost across the redirect, and someone who
        // followed a link to /historical lands on the dashboard instead.
        render(
            <MemoryRouter
                initialEntries={[
                    { pathname: '/', state: { returnTo: '/historical?session=9001' } },
                ]}
            >
                <Landing />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('button', { name: /login or sign up/i }));

        expect(mockLoginWithRedirect).toHaveBeenCalledWith({
            appState: { returnTo: '/historical?session=9001' },
        });
    });

    it('asks for no particular destination when there is no deep link', () => {
        renderWithProviders(<Landing />);

        fireEvent.click(screen.getByRole('button', { name: /login or sign up/i }));

        expect(mockLoginWithRedirect).toHaveBeenCalledWith(undefined);
    });

    it('calls loginWithRedirect when the login button is clicked', () => {
        renderWithProviders(<Landing />);

        fireEvent.click(screen.getByText('Login or Sign Up For An Account'));

        expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
    });

    it('renders the footer text', () => {
        renderWithProviders(<Landing />);

        expect(screen.getByText('UNOFFICIAL TELEMETRY TOOL // F1 23-25')).toBeInTheDocument();
    });

    it('renders SplashBackground and SplashCircuit sub-components', () => {
        renderWithProviders(<Landing />);

        expect(screen.getByTestId('splash-background')).toBeInTheDocument();
        const circuit = screen.getByTestId('splash-circuit');
        expect(circuit).toBeInTheDocument();
        expect(circuit.getAttribute('data-continuous')).toBe('true');
    });
});
