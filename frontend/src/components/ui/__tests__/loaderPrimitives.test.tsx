import { screen, act, renderHook, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

const mockUseReducedMotion = vi.fn<() => boolean | null>(() => false);
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    return { ...actual, useReducedMotion: () => mockUseReducedMotion() };
});

import CyclingStatusLabel from '../CyclingStatusLabel';
import ShimmerBar from '../ShimmerBar';
import { useCyclingIndex } from '../useCyclingIndex';

const MESSAGES = ['FIRST MESSAGE', 'SECOND MESSAGE', 'THIRD MESSAGE'] as const;

describe('CyclingStatusLabel', () => {
    beforeEach(() => {
        mockUseReducedMotion.mockReturnValue(false);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts on the first message', () => {
        renderWithProviders(<CyclingStatusLabel messages={MESSAGES} />);

        expect(screen.getByText('FIRST MESSAGE')).toBeInTheDocument();
    });

    // The index is asserted on the hook rather than through the rendered label:
    // AnimatePresence mode="wait" holds the outgoing element until its exit
    // animation finishes, and rAF does not advance under fake timers.
    it('advances on the interval and wraps around', async () => {
        const { result } = renderHook(() => useCyclingIndex(3, 1000));

        expect(result.current).toBe(0);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current).toBe(1);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(result.current).toBe(0);
    });

    it('does not cycle a single message', async () => {
        const { result } = renderHook(() => useCyclingIndex(1, 1000));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(result.current).toBe(0);
    });

    it('holds still under prefers-reduced-motion', async () => {
        // Rotating text is motion too, and one the user cannot pause.
        mockUseReducedMotion.mockReturnValue(true);
        const { result } = renderHook(() => useCyclingIndex(3, 1000));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(result.current).toBe(0);
    });

    it('announces progress, which the four hand-written copies did not', () => {
        renderWithProviders(<CyclingStatusLabel messages={MESSAGES} />);

        expect(screen.getByRole('status')).toHaveTextContent('FIRST MESSAGE');
    });
});

describe('ShimmerBar', () => {
    beforeEach(() => {
        mockUseReducedMotion.mockReturnValue(false);
    });

    it('exposes itself as a progress indicator', () => {
        renderWithProviders(<ShimmerBar />);

        expect(screen.getByRole('progressbar', { name: /loading/i })).toBeInTheDocument();
    });

    it('animates with a transform rather than backgroundPosition', () => {
        // backgroundPosition is not compositor-accelerated, so framer had to
        // write the inline style from JS on every frame.
        const { container } = renderWithProviders(<ShimmerBar />);

        // An oversized child translated with x, not a viewport-sized layer with
        // backgroundSize 200% and a tweened backgroundPosition.
        //
        // Scoped to the progressbar rather than searched for across the whole
        // container: the style assertion below is the point of the test, but
        // finding the element by that same style meant any other 200% element
        // on the page could satisfy it.
        const fill = within(container)
            .getByRole('progressbar')
            .querySelector<HTMLElement>('[style*="200%"]');
        expect(fill).not.toBeNull();
        expect(fill!.style.width).toBe('200%');
        expect(fill!.style.backgroundSize).not.toBe('200% 100%');
    });
});
