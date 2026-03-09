import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CircuitTraceIdleOverlay from '../CircuitTraceIdleOverlay';

describe('CircuitTraceIdleOverlay', () => {
    it('renders the instructional text', () => {
        render(<CircuitTraceIdleOverlay />);

        expect(screen.getByText('SELECT A RACE AND START A SIMULATION')).toBeInTheDocument();
        expect(screen.getByText('CIRCUIT TRACE WILL APPEAR HERE')).toBeInTheDocument();
    });

    it('renders the SpeedIcon', () => {
        const { container } = render(<CircuitTraceIdleOverlay />);

        // MUI SpeedIcon renders as an SVG with data-testid
        const svgIcon = container.querySelector('svg[data-testid="SpeedIcon"]');
        expect(svgIcon).toBeInTheDocument();
    });
});
