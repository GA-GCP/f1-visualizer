import { describe } from 'vitest';
import { platform } from './browser';
import { accessibilityViolations, signIn } from './checks';
import { expect, test, WEB } from './fixtures';

/**
 * The login journey, end to end against the built bundle.
 *
 * This is the path the audit called out as only ever exercised in production:
 * loginWithRedirect, the code/state round trip, the PKCE token exchange, the
 * post-login splash and the authenticated shell. Every unit test above the
 * component boundary mocks useAuth0, so none of it ran in CI before.
 */
describe('authentication', () => {
    test('signs in through the real redirect handshake and reaches the dashboard', async ({
        page,
    }) => {
        await page.goto('/');

        // The public route renders without a token — a config or CSP failure
        // shows here first, as the app never mounting at all.
        await expect(page.getByRole('button', { name: /login or sign up/i })).toBeVisible();

        await page.getByRole('button', { name: /login or sign up/i }).click();

        // The redirect lands back on '/', the SDK exchanges the code, and
        // onRedirectCallback navigates. Asserting the URL and the shell
        // separately so a failure says which half broke.
        await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
        await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    });

    test('serves the app shell for a deep link rather than a 404', async ({ page }) => {
        // The SPA fallback lives in nginx.conf in production and in vite
        // preview here; either way an unauthenticated deep link must render the
        // app and be redirected, not fail to load. WebDriver reports no status,
        // so the deep link is asked for as the browser asks for a page.
        const answer = await fetch(`${WEB}/dashboard`, { headers: { accept: 'text/html' } });
        expect(answer.status).toBe(200);

        await page.goto('/dashboard');
        await expect(page.getByRole('button', { name: /login or sign up/i })).toBeVisible();
    });

    test('the sign-in button is whole and takes its own clicks on short pages', async ({
        page,
    }) => {
        // Two ways a short page used to fail the button. The footer, pinned
        // near the bottom, took the clicks aimed at it: its middle on the
        // desktop at 1280×577, the page GitHub's runner once gave it, and its
        // lower edge on the phone at 412×500. And on the phone held sideways
        // the content was taller than the page and cut off, the button's lower
        // half below the edge at 839×412 and its middle at 915×412.
        const sizes =
            platform === 'mobile'
                ? [
                      { width: 412, height: 500 },
                      { width: 839, height: 412 },
                      { width: 915, height: 412 },
                  ]
                : [{ width: 1280, height: 577 }];
        await page.goto('/');
        const button = page.getByRole('button', { name: /login or sign up/i });
        await expect(button).toBeVisible();

        const strays: Record<string, string[]> = {};
        for (const size of sizes) {
            // Resized once the page is loaded, and checked: a resize sent
            // before the first load did not hold.
            await page.setViewportSize(size);
            expect(await page.viewportSize()).toEqual(size);
            await page.still();

            // Every point of a grid across the button, edges inset by 2 px:
            // what the page would hand a click there, by elementFromPoint,
            // which finds nothing off the page. Nothing is scrolled first, so
            // the whole button has to be on the page as it opens.
            const missed = await button.evaluate<string[]>(`
                const button = arguments[0];
                const box = button.getBoundingClientRect();
                const missed = [];
                for (const fx of [0, 0.25, 0.5, 0.75, 1]) {
                    for (const fy of [0, 0.5, 1]) {
                        const x = box.left + 2 + fx * (box.width - 4);
                        const y = box.top + 2 + fy * (box.height - 4);
                        const hit = document.elementFromPoint(x, y);
                        if (!button.contains(hit)) {
                            missed.push(Math.round(x) + ',' + Math.round(y) + ' ' + (hit ? hit.outerHTML.slice(0, 60) : 'off the page'));
                        }
                    }
                }
                return missed;
            `);
            if (missed.length > 0) strays[`${size.width}×${size.height}`] = missed;
        }
        expect(strays).toEqual({});
    });
});

describe('accessibility', () => {
    test('the landing page has no axe violations', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('button', { name: /login or sign up/i })).toBeVisible();

        expect(await accessibilityViolations(page)).toEqual([]);
    });

    test('the authenticated shell has no axe violations', async ({ page }) => {
        // The unit suite runs axe on components in isolation. This is the only
        // check of the assembled page: landmark uniqueness, heading order
        // across components, and contrast against the real painted background
        // are all properties of the whole document, not of one component.
        await signIn(page);

        expect(await accessibilityViolations(page)).toEqual([]);
    });
});
