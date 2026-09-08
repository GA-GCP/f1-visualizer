import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forgetSplashSkip, isSplashSkipRemembered } from '../splashPreference';
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

const sequenceOptions = vi.fn();
vi.mock('../useSplashSequence', () => ({
    useSplashSequence: (_onComplete: () => void, options: unknown) => {
        sequenceOptions(options);
        return { phase: 'circuit', progress: 0.5, elapsed: 2500 };
    },
}));

describe('SplashScreen', () => {
    beforeEach(() => {
        forgetSplashSkip();
        sequenceOptions.mockClear();
    });

    it('renders the F1 VISUALIZER title letters', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.5} />);

        // Each letter is rendered individually — check for key letters
        expect(screen.getByText('F')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('V')).toBeInTheDocument();
    });

    it('renders SplashBackground sub-component', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.5} />);

        expect(screen.getByTestId('splash-background')).toBeInTheDocument();
    });

    it('renders SplashCircuit with current phase', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.5} />);

        const circuit = screen.getByTestId('splash-circuit');
        expect(circuit).toBeInTheDocument();
        expect(circuit.getAttribute('data-phase')).toBe('circuit');
    });

    it('renders SplashProgress with current progress', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.5} />);

        const progress = screen.getByTestId('splash-progress');
        expect(progress).toBeInTheDocument();
        expect(progress.getAttribute('data-progress')).toBe('0.5');
    });

    it('has role="status" for accessibility', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.5} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('passes readiness through to the sequence, so the bar tracks real work', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0.75} />);

        expect(sequenceOptions).toHaveBeenCalledWith(
            expect.objectContaining({ readiness: 0.75 }),
        );
    });

    it('offers a skip control that ends the sequence and is remembered', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={0} />);

        expect(isSplashSkipRemembered()).toBe(false);
        expect(sequenceOptions).toHaveBeenLastCalledWith(
            expect.objectContaining({ skipped: false }),
        );

        fireEvent.click(screen.getByRole('button', { name: /skip intro/i }));

        expect(sequenceOptions).toHaveBeenLastCalledWith(
            expect.objectContaining({ skipped: true }),
        );
        // Remembered, so the next login goes straight to the app.
        expect(isSplashSkipRemembered()).toBe(true);
    });

    it('surfaces prefetch failures instead of swallowing them', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={1} failures={['drivers']} />);

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/could not preload drivers/i);
    });

    it('shows no failure notice when startup is healthy', () => {
        render(<SplashScreen onComplete={vi.fn()} readiness={1} />);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
