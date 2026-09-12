import { expect, test } from './fixtures/test';
import type { Locator, Page } from '@playwright/test';

/** Logs in and lands on the dashboard, where the app bar is. */
async function signIn(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: /login or sign up/i }).click();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

/**
 * The text a sighted user can read inside `locator`.
 *
 * The bar hides text below a breakpoint by clipping it to a 1px box rather than
 * removing it, so `innerText` and the accessibility tree both still carry it.
 * Only a text node whose element has a real box is on screen.
 */
function visibleText(locator: Locator): Promise<string> {
    return locator.evaluate((root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const shown: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim();
            const box = node.parentElement?.getBoundingClientRect();
            if (text && box && box.width > 1 && box.height > 1) shown.push(text);
        }
        return shown.join(' ');
    });
}

test.describe('the app bar', () => {
    test('fits the viewport and shows the brand whole or not at all', async ({
        page,
    }, testInfo) => {
        await signIn(page);
        const banner = page.getByRole('banner');

        // Every control inside the viewport: on a Pixel 7 the toolbar once
        // overflowed by about 85px and pushed the logout button off the edge.
        expect(await banner.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);

        // The name is in the DOM at every width, for assistive technology...
        const wordmark = banner.getByText('F1 VISUALIZER', { exact: true });
        await expect(wordmark).toBeAttached();

        // ...and on screen only where the whole of it fits. Below sm the brand
        // is the icon alone.
        const box = await wordmark.boundingBox();
        if (testInfo.project.name === 'mobile') expect(box?.width).toBeLessThanOrEqual(1);
        else await expect(wordmark).toBeVisible();

        // "F1" on its own is Formula One Licensing's trade mark, not this
        // project's name (the disclaimer at the end of the README). It is never
        // displayed except as part of the name, at any width.
        const shown = await visibleText(banner);
        expect(shown.replace(/F1 VISUALIZER/g, '')).not.toMatch(/\bF1\b/);
    });
});
