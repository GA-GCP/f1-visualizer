import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ResizeObserver mock (jsdom doesn't support it)
// Uses a real class so vi.clearAllMocks() in test files won't break construction
class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// matchMedia mock (jsdom doesn't implement it).  Without this, anything that
// reads prefers-reduced-motion — useSplashSequence, framer's useReducedMotion,
// MUI's useMediaQuery — throws on import, which is why App.tsx could not be
// rendered under test at all.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
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
        setTimeout(() => cb(Date.now()), 16) as unknown as number) as typeof global.requestAnimationFrame;
    global.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id)) as typeof global.cancelAnimationFrame;
}

// Automatically clean up after each test
afterEach(() => {
    cleanup();
});
