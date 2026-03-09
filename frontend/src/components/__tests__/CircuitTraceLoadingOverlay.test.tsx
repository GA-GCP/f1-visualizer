import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CircuitTraceLoadingOverlay from '../CircuitTraceLoadingOverlay';

describe('CircuitTraceLoadingOverlay', () => {
    it('displays race info (year, meeting name, driver code)', () => {
        render(
            <CircuitTraceLoadingOverlay year={2024} meetingName="Bahrain Grand Prix" driverCode="VER" />,
        );

        expect(screen.getByText('YOU HAVE SELECTED')).toBeInTheDocument();
        expect(screen.getByText('2024 Bahrain Grand Prix')).toBeInTheDocument();
        expect(screen.getByText('DRIVER: VER')).toBeInTheDocument();
    });

    it('displays the INITIALIZING label', () => {
        render(
            <CircuitTraceLoadingOverlay year={2024} meetingName="Test GP" driverCode="HAM" />,
        );

        expect(screen.getByText('INITIALIZING')).toBeInTheDocument();
    });

    it('shows the first status message initially', () => {
        render(
            <CircuitTraceLoadingOverlay year={2024} meetingName="Test GP" driverCode="LEC" />,
        );

        expect(screen.getByText('CONNECTING TO DATA FEED...')).toBeInTheDocument();
    });

    it('renders the shimmer progress bar', () => {
        const { container } = render(
            <CircuitTraceLoadingOverlay year={2024} meetingName="Test GP" driverCode="LEC" />,
        );

        // The shimmer bar has a gradient background
        const shimmerBar = container.querySelector('div[style*="linear-gradient"]');
        expect(shimmerBar).toBeInTheDocument();
    });
});
