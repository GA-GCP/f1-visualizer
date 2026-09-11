import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Screenshot capture for the README, driven through the e2e stubs.
 *
 * Nothing is deployed, so the pictures come from the same place the e2e suite
 * gets its confidence: the built bundle, the stubbed Auth0 tenant, the fixture
 * API and a STOMP broker mocked at the socket. A separate config rather than
 * a tagged spec, so `yarn test:e2e` never runs — or skips — a capture.
 *
 *   yarn screenshots
 */
export default defineConfig({
  ...base,
  testMatch: /screenshots\.capture\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      // GitHub's social preview is 1280x640; the dashboard framed at that
      // aspect ratio is what the repository card shows.
      name: 'social',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 640 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
