import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import SplashCircuit from '../SplashCircuit';

// Mock framer-motion's animate function to prevent actual animations
vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        animate: vi.fn(() => ({ stop: vi.fn() })),
    };
});

// jsdom doesn't implement SVG geometry methods. Patch them globally.
beforeAll(() => {
    if (!SVGElement.prototype.getTotalLength) {
        (SVGElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 1500;
    }
    if (!SVGElement.prototype.getPointAtLength) {
        (SVGElement.prototype as unknown as { getPointAtLength: (d: number) => { x: number; y: number } }).getPointAtLength = () => ({ x: 100, y: 100 });
    }
});

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
