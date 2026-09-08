import { expect, test } from './fixtures/test';

/** Logs in and lands on the dashboard. Every spec below starts from here. */
async function signIn(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: /login or sign up/i }).click();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

/**
 * Counts pixels the trace has actually painted.
 *
 * Deliberately not toHaveScreenshot: the audit suggested pinning a Playwright
 * Docker image so a reference PNG is reproducible, and without that image a
 * committed baseline is a promise about font rendering and GPU rasterisation
 * that CI cannot keep. Counting non-background pixels asserts the thing that
 * matters — something was drawn — and is identical on every machine.
 */
async function paintedPixels(page: import('@playwright/test').Page): Promise<number> {
    return page
        .locator('canvas')
        .first()
        .evaluate((node: HTMLCanvasElement) => {
            const context = node.getContext('2d');
            if (!context) return -1;
            const { data } = context.getImageData(0, 0, node.width, node.height);
            let painted = 0;
            // The canvas background is a near-black fill; anything materially
            // lighter is the trace, the car dot or the start marker.
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] + data[i + 1] + data[i + 2] > 90) painted++;
            }
            return painted;
        });
}

test.describe('the live trace', () => {
    test('draws the circuit once a simulation is streaming', async ({ page }) => {
        await signIn(page);

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();

        // Nothing has streamed yet, so the canvas is blank behind the idle
        // overlay. Asserting this first is what makes the assertion after the
        // simulation starts mean something.
        expect(await paintedPixels(page)).toBe(0);

        await page.getByLabel(/select grand prix/i).click();
        await page.getByRole('option').first().click();
        await page.getByRole('button', { name: /start simulation/i }).click();

        // The STOMP fixture replays a closed oval at ~40 Hz once the client
        // subscribes to /topic/race-location, so the trace accumulates. This
        // exercises the real client: CONNECT/CONNECTED negotiation, the
        // subscription, the rAF flush loop and the canvas draw path.
        await expect
            .poll(() => paintedPixels(page), {
                message: 'the trace never painted anything',
                timeout: 20_000,
            })
            .toBeGreaterThan(500);
    });

    test('re-scales the canvas when the viewport changes', async ({ page }) => {
        // CircuitTrace sizes its canvas imperatively from a ResizeObserver,
        // which the unit suite replaces with a no-op class — so this behaviour
        // has never run in a test before.
        await signIn(page);

        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();

        const wide = await canvas.evaluate((node: HTMLCanvasElement) => node.width);
        expect(wide).toBeGreaterThan(0);

        // Halve whatever this project's viewport is rather than resizing to a
        // fixed width: the mobile project starts at 412px, so a hard-coded 600
        // made the viewport *wider* and the assertion failed for the right
        // reason on the wrong premise.
        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();
        await page.setViewportSize({
            width: Math.round(viewport!.width / 2),
            height: viewport!.height,
        });

        await expect
            .poll(() => canvas.evaluate((node: HTMLCanvasElement) => node.width), {
                message: 'the canvas backing store never followed the viewport',
                timeout: 10_000,
            })
            .toBeLessThan(wide);
    });
});
