import { describe } from 'vitest';
import { signIn } from './checks';
import { expect, type Locator, platform, test } from './fixtures';

/**
 * The text a sighted user can read inside `locator`.
 *
 * The bar hides text below a breakpoint by clipping it to a 1px box rather than
 * removing it, so `innerText` and the accessibility tree both still carry it.
 * Only a text node whose element has a real box is on screen.
 */
function visibleText(locator: Locator): Promise<string> {
    return locator.evaluate<string>(String.raw`
        const walker = document.createTreeWalker(arguments[0], NodeFilter.SHOW_TEXT);
        const shown = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim();
            const box = node.parentElement?.getBoundingClientRect();
            if (text && box && box.width > 1 && box.height > 1) shown.push(text);
        }
        return shown.join(" ");
    `);
}

describe('the app bar', () => {
    test('fits the viewport and shows the brand whole or not at all', async ({ page }) => {
        await signIn(page);
        const banner = page.getByRole('banner');

        // Every control inside the viewport: on a Pixel 7 the toolbar once
        // overflowed by about 85px and pushed the logout button off the edge.
        expect(
            await banner.evaluate<number>(
                'return arguments[0].scrollWidth - arguments[0].clientWidth',
            ),
        ).toBe(0);

        // The name is in the DOM at every width, for assistive technology...
        const wordmark = banner.getByText('F1 VISUALIZER', { exact: true });
        await expect(wordmark).toHaveCount(1);

        // ...and on screen only where the whole of it fits. Below sm the brand
        // is the icon alone.
        if (platform === 'mobile')
            expect((await wordmark.boundingBox()).width).toBeLessThanOrEqual(1);
        else await expect(wordmark).toBeVisible();

        // "F1" on its own is Formula One Licensing's trade mark, not this
        // project's name (the disclaimer at the end of the README). It is never
        // displayed except as part of the name, at any width.
        const shown = await visibleText(banner);
        expect(shown.replace(/F1 VISUALIZER/g, '')).not.toMatch(/\bF1\b/);
    });
});
