import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CircuitTraceIdleOverlay from '../CircuitTraceIdleOverlay';

describe('CircuitTraceIdleOverlay', () => {
    it('renders the instructional text', () => {
        render(<CircuitTraceIdleOverlay />);

        expect(screen.getByText('SELECT A RACE AND START A SIMULATION')).toBeInTheDocument();
        expect(screen.getByText('CIRCUIT TRACE WILL APPEAR HERE')).toBeInTheDocument();
    });

    it('renders its icon as decoration, not as content', () => {
        const { container } = render(<CircuitTraceIdleOverlay />);

        // Was keyed on svg[data-testid="SpeedIcon"] — MUI's testid convention is
        // an implementation detail it does not guarantee, and which glyph is
        // used is not a contract. That it is hidden from assistive technology
        // is: the message beside it carries the meaning.
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
});
