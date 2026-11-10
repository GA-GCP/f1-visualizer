import { describe } from 'vitest';
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
