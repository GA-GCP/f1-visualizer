import { defineConfig } from 'vitest/config';

/**
 * Screenshot capture for the README (e2e/screenshots.capture.ts), on the same
 * servers and stand-ins as the browser tests. A config of its own rather than a
 * tagged test, so `yarn test:e2e` never runs — or skips — a capture. One file,
 * one test at a time: each capture waits out a streaming trace or an
 * animation, and nothing else should share the machine's time with it.
 *
 *   yarn screenshots
 */
export default defineConfig({
  test: {
    include: ['e2e/screenshots.capture.ts'],
    globalSetup: ['e2e/servers.ts'],
    testTimeout: 90_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
