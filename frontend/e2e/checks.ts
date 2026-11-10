import { AxeBuilder } from '@axe-core/webdriverjs';
import { expect, type Page } from './fixtures';

/** WCAG 2.1 AA and every level below it. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Signs in through the real redirect handshake and lands on the dashboard. */
export async function signIn(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: /login or sign up/i }).click();
    await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

/**
 * What axe finds against WCAG 2.1 AA, rule and elements, so a failure names
 * them. Axe runs in the page itself (legacy mode): the app has no frames, so it
 * needs no window of its own to put their results together.
 */
export async function accessibilityViolations(page: Page): Promise<string[]> {
    const { violations } = await new AxeBuilder(page.driver)
        .withTags(WCAG_AA)
        .setLegacyMode(true)
        .analyze();
    return violations.map(
        (found) => `${found.id}: ${found.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
}
