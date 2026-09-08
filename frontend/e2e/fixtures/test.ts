import { test as base, expect } from '@playwright/test';
import { stubApi } from './api';
import { stubAuth0 } from './auth0';
import { stubTelemetry } from './telemetry';

/**
 * Every spec gets the three stubs installed before the first navigation.
 *
 * An auto fixture rather than a beforeEach, so the ordering is guaranteed: a
 * route registered after `page.goto` misses the requests the app fires on boot,
 * and that failure looks like a flaky timeout rather than a missing stub.
 */
export const test = base.extend<{ stubbed: void }>({
    stubbed: [
        async ({ page }, use) => {
            await stubAuth0(page);
            await stubApi(page);
            await stubTelemetry(page);
            await use();
        },
        { auto: true },
    ],
});

export { expect };
