import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { expect, afterEach, vi  } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

// axe assertions: `expect(await axe(container)).toHaveNoViolations()`
expect.extend(axeMatchers);

// ResizeObserver mock (jsdom doesn't support it)
// Uses a real class so vi.clearAllMocks() in test files won't break construction
class ResizeObserverMock {
    observe() {}
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
            throw new SyntaxError(`The mark '${performanceMarks.has(start) ? end : start}' does not exist.`);
        }
        return { name, duration: performanceMarks.get(end)! - performanceMarks.get(start)! };
    },
});
Object.defineProperty(performance, 'clearMarks', {
    writable: true,
    configurable: true,
    value: () => performanceMarks.clear(),
});

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
    global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 16) as unknown as number);
    global.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id));
}

// Automatically clean up after each test
afterEach(() => {
    cleanup();
});
