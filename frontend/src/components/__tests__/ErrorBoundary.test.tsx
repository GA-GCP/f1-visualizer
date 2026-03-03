import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

const BombComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test Explosion');
    }
    return <div>All systems nominal</div>;
};

describe('ErrorBoundary', () => {
    it('catches errors and displays the fault UI', () => {
        // Suppress console.error so it doesn't clutter test output
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <BombComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('SYSTEM FAULT DETECTED')).toBeInTheDocument();
        expect(screen.getByText('Test Explosion')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('renders children normally when no error occurs', () => {
        render(
            <ErrorBoundary>
                <BombComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('All systems nominal')).toBeInTheDocument();
        expect(screen.queryByText('SYSTEM FAULT DETECTED')).not.toBeInTheDocument();
    });
});