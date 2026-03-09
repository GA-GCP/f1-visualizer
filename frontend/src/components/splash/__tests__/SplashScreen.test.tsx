import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SplashScreen from '../SplashScreen';

// Mock sub-components to isolate SplashScreen logic
vi.mock('../SplashBackground', () => ({
    default: () => <div data-testid="splash-background" />,
}));

vi.mock('../SplashCircuit', () => ({
    default: ({ phase }: { phase: string }) => <div data-testid="splash-circuit" data-phase={phase} />,
}));

vi.mock('../SplashProgress', () => ({
    default: ({ progress }: { progress: number }) => (
        <div data-testid="splash-progress" data-progress={progress} />
    ),
}));

vi.mock('../useSplashSequence', () => ({
    useSplashSequence: () => ({ phase: 'circuit', progress: 0.5, elapsed: 2500 }),
}));

describe('SplashScreen', () => {
    it('renders the F1 VISUALIZER title letters', () => {
        render(<SplashScreen onComplete={vi.fn()} />);

        // Each letter is rendered individually — check for key letters
        expect(screen.getByText('F')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('V')).toBeInTheDocument();
    });

    it('renders SplashBackground sub-component', () => {
        render(<SplashScreen onComplete={vi.fn()} />);

        expect(screen.getByTestId('splash-background')).toBeInTheDocument();
    });

    it('renders SplashCircuit with current phase', () => {
        render(<SplashScreen onComplete={vi.fn()} />);

        const circuit = screen.getByTestId('splash-circuit');
        expect(circuit).toBeInTheDocument();
        expect(circuit.getAttribute('data-phase')).toBe('circuit');
    });

    it('renders SplashProgress with current progress', () => {
        render(<SplashScreen onComplete={vi.fn()} />);

        const progress = screen.getByTestId('splash-progress');
        expect(progress).toBeInTheDocument();
        expect(progress.getAttribute('data-progress')).toBe('0.5');
    });

    it('has role="status" for accessibility', () => {
        render(<SplashScreen onComplete={vi.fn()} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});
