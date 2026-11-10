import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject, test as base } from 'vitest';
import { asPlatform, AUTH0_DOMAIN, openBrowser, platform } from './browser';
import { Page, WEB } from './page';
import type { WebDriver } from 'selenium-webdriver';
import type { Driver as ChromeDriver } from 'selenium-webdriver/chrome';

export { platform } from './browser';
export { expect } from './expect';
export { Locator, Page, WEB, type Text } from './page';

/**
 * Where a failed test leaves a picture of its page, named for its platform and
 * itself: frontend/e2e-results, which git ignores and the PR check uploads.
 */
const RESULTS = fileURLToPath(new URL('../e2e-results/', import.meta.url));

/** What a browser of the tests' keeps for an origin: the app's and the Auth0 stand-in's. */
const ORIGINS = [WEB, `https://${AUTH0_DOMAIN}`];

/**
 * A browser for the test as a new one is: a tab of its own, every other
 * closed, and with them their session storage and the emulation DevTools set on
 * them; every cookie gone, and every store of the app's and the stand-in's; and
 * the tab the platform's. The SDK keeps its tokens in memory, so a closed tab
 * takes them with it.
 */
async function cleared(driver: WebDriver): Promise<void> {
    const tabs = await driver.getAllWindowHandles();
    await driver.switchTo().newWindow('tab');
    const tab = await driver.getWindowHandle();
    for (const old of tabs) {
        await driver.switchTo().window(old);
        await driver.close();
    }
    await driver.switchTo().window(tab);
    const chrome = driver as ChromeDriver;
    await chrome.sendDevToolsCommand('Network.clearBrowserCookies', {});
    for (const origin of ORIGINS) {
        await chrome.sendDevToolsCommand('Storage.clearDataForOrigin', {
            origin,
            storageTypes: 'all',
        });
    }
    await asPlatform(driver);
}

/**
 * One Chrome for a file's tests, opened when the first asks for it and quit
 * when the file ends: opening Chrome takes longer than most tests. Each test is
 * given it cleared. One that can't be, crashed or held by a dialog, is quit, and
 * another opened.
 */
class FileChrome {
    private driver: WebDriver | undefined;

    async page(): Promise<Page> {
        if (this.driver) {
            try {
                await cleared(this.driver);
                return new Page(this.driver);
            } catch (failure) {
                // Said, so a Chrome opened for every test shows in the run's output.
                console.warn(
                    `The file's Chrome couldn't be cleared, so another is opened: ${String(failure)}`,
                );
                await this.quit();
            }
        }
        this.driver = await openBrowser(inject('standInKey'));
        return new Page(this.driver);
    }

    async quit(): Promise<void> {
        const driver = this.driver;
        this.driver = undefined;
        await driver?.quit().catch(() => undefined);
    }
}

/**
 * Each test's page, in the file's own Chrome, cleared for the test. A test that
 * fails leaves a picture of where its page was in e2e-results/.
 */
export const test = base.extend<{
    $test: { page: Page };
    $file: { chrome: FileChrome };
}>({
    chrome: [
        // Vitest reads a fixture's dependencies from its first parameter's
        // pattern; an empty one is how a fixture says it has none.
        // eslint-disable-next-line no-empty-pattern
        async ({}, provide) => {
            const chrome = new FileChrome();
            try {
                await provide(chrome);
            } finally {
                await chrome.quit();
            }
        },
        { scope: 'file' },
    ],
    page: async ({ chrome, task, onTestFailed }, provide) => {
        const page = await chrome.page();
        onTestFailed(async () => {
            const name = `${platform}-${task.name}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
            await page.screenshot(join(RESULTS, `${name}.png`)).catch(() => undefined);
        });
        await provide(page);
    },
});
