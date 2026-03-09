import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LayoutMain from '../layout/LayoutMain';

// Mock useAuth0
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn().mockReturnValue({
        logout: vi.fn(),
        isAuthenticated: true
    })
}));

// Mock UserSettingsModal to avoid its internal dependencies
vi.mock('../layout/UserSettingsModal', () => ({
    default: () => <div data-testid="mock-settings-modal">Settings Modal</div>
}));

describe('LayoutMain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders navigation buttons (Live Console, Data Vault, Head-to-Head)', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>
        );

        expect(screen.getByText('Live Console')).toBeInTheDocument();
        expect(screen.getByText('Data Vault')).toBeInTheDocument();
        expect(screen.getByText('Head-to-Head')).toBeInTheDocument();
    });

    it('highlights active route', () => {
        render(
            <MemoryRouter initialEntries={['/historical']}>
                <LayoutMain />
            </MemoryRouter>
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
            </MemoryRouter>
        );

        expect(screen.getByText('UNOFFICIAL TELEMETRY TOOL // F1 23-25')).toBeInTheDocument();
    });

    it('renders the app title', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>
        );

        expect(screen.getByText('F1 VISUALIZER')).toBeInTheDocument();
    });

    it('renders the mocked UserSettingsModal', () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <LayoutMain />
            </MemoryRouter>
        );

        expect(screen.getByTestId('mock-settings-modal')).toBeInTheDocument();
    });
});
