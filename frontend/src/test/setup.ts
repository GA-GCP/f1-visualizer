import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ResizeObserver mock (jsdom doesn't support it)
// Uses a real class so vi.clearAllMocks() in test files won't break construction
class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

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
