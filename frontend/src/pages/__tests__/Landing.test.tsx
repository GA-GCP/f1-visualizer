import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { useAuth0 } from '@auth0/auth0-react';

describe('Landing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth0 as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            loginWithRedirect: mockLoginWithRedirect,
        });
    });

    it('renders the F1 VISUALIZER title letters', () => {
        render(<Landing />);

        expect(screen.getByText('F')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('V')).toBeInTheDocument();
    });

    it('renders the tagline', () => {
        render(<Landing />);

        expect(
            screen.getByText('REAL-TIME TELEMETRY // HISTORICAL ANALYSIS // DRIVER COMPARISON'),
        ).toBeInTheDocument();
    });

    it('renders the login button', () => {
        render(<Landing />);

        expect(screen.getByText('Login or Sign Up For An Account')).toBeInTheDocument();
    });

    it('calls loginWithRedirect when the login button is clicked', () => {
        render(<Landing />);

        fireEvent.click(screen.getByText('Login or Sign Up For An Account'));

        expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
    });

    it('renders the footer text', () => {
        render(<Landing />);

        expect(screen.getByText('UNOFFICIAL TELEMETRY TOOL // F1 23-25')).toBeInTheDocument();
    });

    it('renders SplashBackground and SplashCircuit sub-components', () => {
        render(<Landing />);

        expect(screen.getByTestId('splash-background')).toBeInTheDocument();
        const circuit = screen.getByTestId('splash-circuit');
        expect(circuit).toBeInTheDocument();
        expect(circuit.getAttribute('data-continuous')).toBe('true');
    });
});
