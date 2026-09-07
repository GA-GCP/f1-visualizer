import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SplashCircuit from '../SplashCircuit';

// Mock framer-motion's animate function to prevent actual animations
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

// SVG geometry methods are stubbed globally in src/test/setup.ts.

describe('SplashCircuit', () => {
    it('renders an SVG with the correct viewBox', () => {
        const { container } = render(<SplashCircuit phase="circuit" />);

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 580 300');
    });

    it('renders at least one path element for the circuit', () => {
        const { container } = render(<SplashCircuit phase="background" />);

        const paths = container.querySelectorAll('svg path');
        expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the circuit container box', () => {
        const { container } = render(<SplashCircuit phase="circuit" />);

        const box = container.firstChild as HTMLElement;
        expect(box).toBeInTheDocument();
    });

    it('accepts continuous prop without crashing', () => {
        const { container } = render(<SplashCircuit continuous />);

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });
});
