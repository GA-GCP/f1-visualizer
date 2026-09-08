import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SplashCircuit from '../SplashCircuit';

// Mock framer-motion's animate function to prevent actual animations
const mockUseReducedMotion = vi.fn(() => false);

vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion');
    return {
        ...actual,
        animate: vi.fn(() => ({ stop: vi.fn() })),
        useReducedMotion: () => mockUseReducedMotion(),
    };
});

// SVG geometry methods are stubbed globally in src/test/setup.ts.

describe('SplashCircuit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseReducedMotion.mockReturnValue(false);
    });

    it('does not start the perpetual orbit under prefers-reduced-motion', async () => {
        // The dot orbits for the life of the landing page, which is exactly the
        // kind of motion the preference exists to stop. It stays rendered —
        // parked at the start of the lap — rather than disappearing.
        const { animate } = await import('framer-motion');
        mockUseReducedMotion.mockReturnValue(true);

        render(<SplashCircuit phase="circuit" continuous />);
        await vi.waitFor(() => expect(animate).not.toHaveBeenCalled());
    });

    it('draws the dot glow with a gradient rather than a filter', () => {
        // Two chained drop-shadows on a moving element made the browser
        // recompute a filter region every frame of a perpetual animation.
        const { container } = render(<SplashCircuit phase="circuit" continuous />);

        expect(container.querySelector('radialGradient#f1v-dot-glow')).toBeInTheDocument();
        const filtered = [...container.querySelectorAll<SVGElement>('circle')].filter((c) =>
            c.style.filter?.includes('drop-shadow'),
        );
        expect(filtered).toHaveLength(0);
    });

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
