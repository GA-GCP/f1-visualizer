import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SplashProgress from '../SplashProgress';

describe('SplashProgress', () => {
    it('renders the SYSTEMS CHECK header', () => {
        render(<SplashProgress progress={0} />);

        expect(screen.getByText('SYSTEMS CHECK')).toBeInTheDocument();
    });

    it('shows the correct status message for low progress', () => {
        render(<SplashProgress progress={0.1} />);

        expect(screen.getByText('INITIALIZING TELEMETRY...')).toBeInTheDocument();
    });

    it('shows the correct status message for mid progress', () => {
        render(<SplashProgress progress={0.3} />);

        expect(screen.getByText('LOADING DATA FEEDS...')).toBeInTheDocument();
    });

    it('shows the correct status message for high progress', () => {
        render(<SplashProgress progress={0.6} />);

        expect(screen.getByText('CALIBRATING SENSORS...')).toBeInTheDocument();
    });

    it('shows PIT LANE CLEAR when progress reaches 1', () => {
        render(<SplashProgress progress={1.0} />);

        expect(screen.getByText('PIT LANE CLEAR')).toBeInTheDocument();
    });
});
