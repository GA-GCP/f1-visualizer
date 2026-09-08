import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { expect, afterEach, vi } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// axe assertions: `expect(await axe(container)).toHaveNoViolations()`
expect.extend(axeMatchers);

// ResizeObserver mock (jsdom doesn't support it).
// A real class rather than vi.fn(), so vi.clearAllMocks() in a test file cannot
// break construction.
//
// It delivers an initial observation, because a real one does. The previous
// no-op version never called back, so any component that waits for a
// measurement before rendering — which is the correct way to avoid building at
// a guessed size — simply never rendered under test, and its code silently
// left the coverage report. jsdom reports every element as 0x0, so a nominal
// desktop size stands in.
const RESIZE_OBSERVER_TEST_SIZE = { width: 800, height: 500 };

class ResizeObserverMock implements ResizeObserver {
    // A plain field, not a parameter property: tsconfig sets erasableSyntaxOnly.
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(target: Element) {
        // The target's own rect first, so a test that stubs
        // getBoundingClientRect gets the size it asked for; the nominal size is
        // only the fallback for jsdom's default 0x0.
        const rect = target.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : RESIZE_OBSERVER_TEST_SIZE.width;
        const height = rect.height > 0 ? rect.height : RESIZE_OBSERVER_TEST_SIZE.height;
        const contentRect = {
            width,
            height,
            top: 0,
            left: 0,
            right: width,
            bottom: height,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRectReadOnly;
        this.callback([{ target, contentRect } as ResizeObserverEntry], this);
    }

    unobserve() {}
    disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// User Timing API (jsdom implements only performance.now). perf.ts guards every
// call, so without this the mark/measure tests would pass by taking the
// 'unsupported environment' path rather than by exercising the logic.
// Minimal but faithful: mark records a timestamp, measure returns the gap and
// throws on a missing mark, which is the behaviour perf.ts relies on.
const performanceMarks = new Map<string, number>();
Object.defineProperty(performance, 'mark', {
    writable: true,
    configurable: true,
    value: (name: string) => {
        performanceMarks.set(name, performance.now());
    },
});
Object.defineProperty(performance, 'measure', {
    writable: true,
    configurable: true,
    value: (name: string, start: string, end: string) => {
        if (!performanceMarks.has(start) || !performanceMarks.has(end)) {
            throw new SyntaxError(
                `The mark '${performanceMarks.has(start) ? end : start}' does not exist.`,
            );
        }
        return { name, duration: performanceMarks.get(end)! - performanceMarks.get(start)! };
    },
});
Object.defineProperty(performance, 'clearMarks', {
    writable: true,
    configurable: true,
    value: () => performanceMarks.clear(),
});

// React 19's "not wrapped in act(...)" warning means an update was flushed
// outside act, so assertions afterwards may be reading stale DOM. It is a
// warning, so a suite stays green while producing it — this run produced five —
// and the noise hides the ones that matter. Thrown instead, which is the only
// way a warning stops accumulating.
//
// Narrow on purpose: every other console.error still prints. Several tests
// deliberately exercise failure paths and log through them, so failing the
// suite on any console.error would mean deleting real assertions to keep it
// quiet.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
        throw new Error(args[0]);
    }
    originalConsoleError(...args);
};

// sendBeacon mock (jsdom doesn't implement it either). Defined rather than
// left absent so the vitals tests exercise the real send path — webVitals.ts
// feature-detects it, so without this the assertion 'no beacon was sent' would
// pass for the wrong reason.
Object.defineProperty(navigator, 'sendBeacon', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(true),
});

// matchMedia mock (jsdom doesn't implement it).  Without this, anything that
// reads prefers-reduced-motion — useSplashSequence, framer's useReducedMotion,
// MUI's useMediaQuery — throws on import, which is why App.tsx could not be
// rendered under test at all.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    // configurable so a test can override it (e.g. to assert reduced motion).
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// scrollTo stub — jsdom logs 'Not implemented: Window's scrollTo()' six times
// per run without it (react-router calls it on navigation).
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });

// SVG geometry mocks (jsdom implements no SVG layout, so these throw).
// Needed by anything rendering SplashCircuit — including the Landing page.
const svgProto = SVGElement.prototype as unknown as {
    getTotalLength?: () => number;
    getPointAtLength?: (d: number) => { x: number; y: number };
};
svgProto.getTotalLength ??= () => 1500;
svgProto.getPointAtLength ??= () => ({ x: 100, y: 100 });

// requestAnimationFrame / cancelAnimationFrame mock (consistent 60fps simulation)
if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 16) as unknown as number;
    global.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Automatically clean up after each test
afterEach(() => {
    cleanup();
});
