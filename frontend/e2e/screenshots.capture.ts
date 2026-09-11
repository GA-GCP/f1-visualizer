import { fileURLToPath } from 'node:url';
import { DRIVERS, LAPS } from './fixtures/api';
import { expect, test } from './fixtures/test';
import type { Page } from '@playwright/test';

/** docs/screenshots at the repository root, wherever Playwright is launched from. */
const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

/** The fixture stubs return one driver's stats and laps for any id; give the second driver its own. */
async function twoDrivers(page: Page): Promise<void> {
    // Registered after the auto fixture's catch-all, so these run first.
    await page.route('**/analysis/drivers/4/stats', (route) =>
        route.fulfill({ json: DRIVERS[1].stats }),
    );
    await page.route(/\/analysis\/session\/\d+\/laps$/, (route) =>
        route.fulfill({
            json: [
                ...LAPS,
                ...LAPS.map((lap, i) => ({
                    ...lap,
                    driverNumber: 4,
                    lapDuration: 92.9 + Math.cos(i / 2) * 0.6 - i * 0.03,
                    compound: i < 7 ? 'MEDIUM' : 'HARD',
                })),
            ],
        }),
    );
}

async function signIn(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: /login or sign up/i }).click();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

/** Blur whatever the last click focused, frame from the top (or on `focusOn`), then capture. */
async function shot(
    page: Page,
    name: string,
    projectName: string,
    focusOn?: string,
): Promise<void> {
    await page.evaluate((selectorText) => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
        if (selectorText) {
            const heading = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((el) =>
                el.textContent?.toLowerCase().includes(selectorText),
            );
            heading?.scrollIntoView({ block: 'start' });
            window.scrollBy(0, -96); // clear the fixed app bar
        }
    }, focusOn ?? '');
    await page.waitForTimeout(400);
    const suffix = projectName === 'desktop' ? '' : `-${projectName}`;
    await page.screenshot({ path: `${OUT}${name}${suffix}.png`, animations: 'disabled' });
}

test.describe('screenshots', () => {
    test('landing page', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop');
        await page.goto('/');
        await expect(page.getByRole('button', { name: /login or sign up/i })).toBeVisible();
        // The title reveal and the CTA glow finish within about three seconds.
        await page.waitForTimeout(3_500);
        await shot(page, 'landing', testInfo.project.name);
    });

    test('live console with a streaming trace', async ({ page }, testInfo) => {
        await signIn(page);
        await page.getByLabel(/select grand prix/i).click();
        await page.getByRole('option').first().click();
        await page.getByRole('button', { name: /start simulation/i }).click();
        // The fixture replays a 240-point circuit at ~40 Hz; one full lap is
        // six seconds, so wait for the oval to close before framing it.
        await page.waitForTimeout(7_000);
        // The card is the trace itself, framed at GitHub's 2:1 preview ratio.
        if (testInfo.project.name === 'social')
            await shot(page, 'social-preview', 'desktop', 'circuit trace');
        else await shot(page, 'live-console', testInfo.project.name);
    });

    test('data vault with a lap chart', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop');
        await twoDrivers(page);
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
        await page.waitForTimeout(1_500);
        await shot(page, 'data-vault', testInfo.project.name);
    });

    test('head-to-head comparison', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop');
        await twoDrivers(page);
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
        await page.waitForTimeout(2_500);
        await shot(page, 'head-to-head', testInfo.project.name);
    });
});
