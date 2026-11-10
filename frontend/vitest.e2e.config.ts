import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * The end-to-end layer, on Selenium WebDriver.
 *
 * Everything above the component boundary is mocked in the unit suite —
 * useAuth0, stompClient, ResizeObserver, d3, canvas.getContext — so the pyramid
 * had a wide base and nothing on top. No test loaded index.html, ran the real
 * build, or completed the Auth0 redirect handshake. The bugs users actually hit
 * (a CSP blocking Auth0, a splash that never dismisses, a canvas that does not
 * re-scale) were invisible to CI.
 *
 * These tests run against the *built* bundle served by `vite preview`, not the
 * dev server: rolldown's output is what ships, and a chunking or `define`
 * regression only exists there. e2e/servers.ts starts it, with stand-ins for
 * the API, the STOMP broker and the Auth0 tenant, once for the run. Each file
 * opens one Chrome, cleared for each test (e2e/fixtures.ts), on the platform
 * F1V_E2E_PLATFORM names (e2e/browser.ts): `pnpm test:e2e:desktop` or
 * `test:e2e:mobile` after `pnpm build --mode e2e`, or `pnpm test:e2e` for the
 * build and both. Chrome is the PR check runner's own, and elsewhere Chrome for
 * Testing, from `pnpm e2e:chrome`.
 *
 * A `.only` left in a test fails the run on CI (Vitest's allowOnly is off
 * there), so it can never narrow the suite to one test while reporting green.
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.spec.ts'],
    globalSetup: ['e2e/servers.ts'],
    // A file's Chrome is opened inside its first test's time.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // A test mostly waits on its browser. Half the cores, and never fewer than
    // two: GitHub's Linux runner has four, and the files are few.
    maxWorkers: Math.max(2, Math.floor(availableParallelism() / 2)),
    // A runner's Chrome is slower and busier than a workstation's; a test that
    // fails twice and then passes still shows in the output as retried.
    retry: process.env.CI ? 2 : 0,
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['default'],
  },
});
