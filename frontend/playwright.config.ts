import { defineConfig, devices } from '@playwright/test';

/**
 * The end-to-end layer.
 *
 * Everything above the component boundary was mocked in the unit suite —
 * useAuth0, stompClient, ResizeObserver, d3, canvas.getContext — so the pyramid
 * had a wide base and nothing on top. No test loaded index.html, ran the real
 * build, or completed the Auth0 redirect handshake. The bugs users actually hit
 * (a CSP blocking Auth0, a splash that never dismisses, a canvas that does not
 * re-scale) were invisible to CI.
 *
 * These specs run against the *built* bundle served by `vite preview`, not the
 * dev server: rolldown's output is what ships, and a chunking or `define`
 * regression only exists there.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,

    // A .only left in a spec silently narrows the suite to one test while still
    // reporting green.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list']],

    use: {
        baseURL: 'http://127.0.0.1:4173',
        // Only kept when a test actually fails, so a green run leaves nothing
        // behind but the flake that failed once has a full timeline.
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        // The audit's accessibility findings included a text size that only
        // fell below the minimum at a narrow width, because it came from the
        // *minimum* of a clamp(). A desktop-only run would not have seen it.
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],

    webServer: {
        // Builds first: `vite preview` serves whatever is in dist/, so without
        // this the run would silently test a stale bundle from a previous mode.
        command: 'yarn build --mode e2e && yarn vite preview --port 4173 --strictPort --host 127.0.0.1',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
