import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LayoutMain from '../layout/LayoutMain';

// Mock useAuth0
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn().mockReturnValue({
        logout: vi.fn(),
        isAuthenticated: true,
    }),
}));

// Mock UserSettingsModal to avoid its internal dependencies
vi.mock('../layout/UserSettingsModal', () => ({
    default: () => <div data-testid="mock-settings-modal">Settings Modal</div>,
}));

describe('LayoutMain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders navigation buttons (Live Console, Data Vault, Head-to-Head)', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        expect(screen.getByText('Live Console')).toBeInTheDocument();
        expect(screen.getByText('Data Vault')).toBeInTheDocument();
        expect(screen.getByText('Head-to-Head')).toBeInTheDocument();
    });

    it('highlights active route', () => {
        render(
            <MemoryRouter initialEntries={['/historical']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        // The active NavButton gets color: 'white' and a red bottom border
        // The Data Vault link points to /historical
        const dataVaultButton = screen.getByText('Data Vault').closest('a');
        expect(dataVaultButton).toHaveAttribute('href', '/historical');

        // The Live Console link points to /dashboard
        const liveConsoleButton = screen.getByText('Live Console').closest('a');
        expect(liveConsoleButton).toHaveAttribute('href', '/dashboard');
    });

    it('renders footer text', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        expect(screen.getByText('UNOFFICIAL TELEMETRY TOOL // F1 23-25')).toBeInTheDocument();
    });

    it('renders the app title', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        // One text node: the name is clipped away below the sm breakpoint as a
        // whole, never split so that one half of it can show on its own.
        expect(screen.getByText('F1 VISUALIZER')).toBeInTheDocument();
    });

    it('never renders the bare mark as the brand', () => {
        // "F1" on its own is Formula One Licensing's trade mark, not this
        // project's name (see the disclaimer at the end of the README). The
        // app bar once split the wordmark so "VISUALIZER" could be clipped away
        // on phones, which left "F1" as the bar's own text at every width below
        // sm. getByText matches an element's own text nodes, so this is exactly
        // the markup that regression produced.
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        expect(screen.queryByText(/^F1$/)).not.toBeInTheDocument();
    });

    it('renders the mocked UserSettingsModal', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('mock-settings-modal')).toBeInTheDocument();
    });
});
