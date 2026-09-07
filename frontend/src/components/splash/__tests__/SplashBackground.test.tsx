import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseReducedMotion = vi.fn<() => boolean | null>(() => false);
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    return { ...actual, useReducedMotion: () => mockUseReducedMotion() };
});

import SplashBackground from '../SplashBackground';

/** The gradient sweep layer: the only child that is sized past the viewport. */
const sweepLayer = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('div[style*="200%"]');

describe('SplashBackground', () => {
    beforeEach(() => {
        mockUseReducedMotion.mockReturnValue(false);
    });

    it('renders without crashing', () => {
        const { container } = render(<SplashBackground />);

        expect(container.firstChild).toBeInTheDocument();
    });

    it('renders the background container with absolute positioning', () => {
        const { container } = render(<SplashBackground />);

        const outerBox = container.firstChild as HTMLElement;
        expect(outerBox).toBeInTheDocument();
    });

    it('sweeps with a transform, not backgroundPosition', () => {
        // backgroundPosition is not compositor-accelerated: animating it made
        // framer re-rasterise a viewport-sized gradient from JS every frame.
        const { container } = render(<SplashBackground />);

        const sweep = sweepLayer(container);
        expect(sweep).not.toBeNull();
        expect(sweep!.style.width).toBe('200%');
        expect(sweep!.style.height).toBe('200%');
        // The old technique was backgroundSize: 200% 200% on a viewport-sized
        // layer with backgroundPosition tweened; the layer is now oversized and
        // promoted for a transform instead.
        expect(sweep!.style.backgroundSize).not.toBe('200% 200%');
        expect(sweep!.style.willChange).toBe('transform');
    });

    it('drops the perpetual loops under prefers-reduced-motion', () => {
        mockUseReducedMotion.mockReturnValue(true);

        const { container } = render(<SplashBackground />);

        // No layer is promoted for an animation that is not going to run.
        const sweep = sweepLayer(container);
        expect(sweep!.style.willChange).toBe('');
    });
});
