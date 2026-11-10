import { fileURLToPath } from 'node:url';
import { describe } from 'vitest';
import { signIn } from './checks';
import { expect, type Page, platform, test } from './fixtures';
import { sleep } from './page';

/** docs/screenshots at the repository root, wherever Vitest is launched from. */
const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

/** The README's desktop captures, and GitHub's social preview, which is 1280x640. */
const DESKTOP = { width: 1440, height: 1000 };
const SOCIAL = { width: 1280, height: 640 };

const desktop = platform === 'desktop';

/**
 * Blur whatever the last click focused, frame from the top (or on the heading
 * holding `focusOn`), bring every animation to rest, then capture.
 */
async function shot(page: Page, name: string, focusOn = ''): Promise<void> {
    await page.evaluate(
        String.raw`
        const focusOn = arguments[0];
        document.activeElement?.blur();
        window.scrollTo(0, 0);
        if (focusOn) {
            const heading = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].find((el) =>
                el.textContent?.toLowerCase().includes(focusOn),
            );
            heading?.scrollIntoView({ block: "start" });
            window.scrollBy(0, -96); // clear the fixed app bar
        }
    `,
        focusOn,
    );
    await sleep(400);
    await page.still();
    await page.screenshot(`${OUT}${name}.png`);
}

/** Signs in on the live console and starts the fixture simulation streaming. */
async function streaming(page: Page): Promise<void> {
    await signIn(page);
    await page.getByLabel(/select grand prix/i).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /start simulation/i }).click();
    // The stand-in replays a 240-point circuit at ~40 Hz; one full lap is six
    // seconds, so wait for the oval to close before framing it.
    await sleep(7_000);
}

/**
 * Screenshot capture for the README, driven through the e2e stand-ins.
 *
 * Nothing is deployed, so the pictures come from the same place the e2e suite
 * gets its confidence: the built bundle, the Auth0 stand-in, the fixture API
 * and a STOMP broker on the app's own origin. A file of its own, under its own
 * config (vitest.screenshots.config.ts), so `pnpm test:e2e` never runs — or
 * skips — a capture. The desktop's run takes every page; the phone's takes the
 * live console, which e2e/screenshots.compose.ts sets in front of the
 * desktop's.
 *
 *   pnpm screenshots
 */
describe('screenshots', () => {
    test.runIf(desktop)('landing page', async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto('/');
        await expect(page.getByRole('button', { name: /login or sign up/i })).toBeVisible();
        // The title reveal and the CTA glow finish within about three seconds.
        await sleep(3_500);
        await shot(page, 'landing');
    });

    test('live console with a streaming trace', async ({ page }) => {
        if (desktop) await page.setViewportSize(DESKTOP);
        await streaming(page);
        await shot(page, desktop ? 'live-console' : 'live-console-mobile');
    });

    test.runIf(desktop)('social preview', async ({ page }) => {
        // The card is the trace itself, framed at GitHub's 2:1 preview ratio.
        await page.setViewportSize(SOCIAL);
        await streaming(page);
        await shot(page, 'social-preview', 'circuit trace');
    });

    test.runIf(desktop)('data vault with a lap chart', async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await signIn(page);
        await page
            .getByRole('link', { name: /data vault|historical/i })
            .first()
            .click();
        await page.getByLabel(/target grand prix/i).click();
        await page.getByRole('option').first().click();
        await expect(page.getByRole('heading', { name: /lap times/i })).toBeVisible({
            timeout: 15_000,
        });
        await sleep(1_500);
        await shot(page, 'data-vault');
    });

    test.runIf(desktop)('head-to-head comparison', async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await signIn(page);
        await page
            .getByRole('link', { name: /head.to.head|versus/i })
            .first()
            .click();
        await page.getByLabel(/driver a/i).click();
        await page.getByRole('option', { name: /verstappen/i }).click();
        await page.getByLabel(/driver b/i).click();
        await page.getByRole('option', { name: /norris/i }).click();
        await expect(page.getByText(/attribute mapping/i)).toBeVisible({ timeout: 15_000 });
        // The stat bars animate in with Framer Motion.
        await sleep(2_500);
        await shot(page, 'head-to-head');
    });
});
