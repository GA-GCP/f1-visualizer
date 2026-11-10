import { chromeOptions, openChrome } from './chrome';
import type { WebDriver } from 'selenium-webdriver';
import type { Driver as ChromeDriver } from 'selenium-webdriver/chrome';

/**
 * The platforms the browser tests run on, both in Chrome: a desktop, and a
 * Pixel 7 in Chrome's own mobile emulation. The audit's accessibility findings
 * included a text size that only fell below the minimum at a narrow width,
 * because it came from the *minimum* of a clamp(); a desktop-only run would not
 * have seen it. F1V_E2E_PLATFORM names one; `yarn test:e2e:desktop` and
 * `test:e2e:mobile` set it.
 */
export type Platform = 'desktop' | 'mobile';

function chosen(value: string | undefined): Platform {
    if (value === 'desktop' || value === 'mobile') return value;
    throw new Error(`F1V_E2E_PLATFORM is ${value ?? 'not set'}: desktop or mobile`);
}

export const platform: Platform = chosen(process.env.F1V_E2E_PLATFORM);

/** The Auth0 tenant .env.e2e names, and the stand-in that answers for it (e2e/servers.ts). */
export const AUTH0_DOMAIN = 'auth.e2e.test';
export const AUTH0_PORT = 4174;

/**
 * chromedriver's mobile emulation by a device's metrics and user agent, which
 * selenium-webdriver passes on as given; its type names only a device's name or
 * bare metrics.
 */
interface MobileEmulation {
    deviceMetrics: {
        width: number;
        height: number;
        pixelRatio: number;
        touch: boolean;
        mobile: boolean;
    };
    userAgent: string;
}

declare module 'selenium-webdriver/chromium.js' {
    interface Options {
        setMobileEmulation(config: MobileEmulation): this;
    }
}

/**
 * The desktop's page, and a Pixel 7's page and browser as Chrome describes
 * them. The phone's touch screen is given through DevTools (`asPlatform`):
 * chromedriver's own would also turn the mouse's events into touches.
 */
const DESKTOP = { width: 1280, height: 720 };
const PIXEL_7: MobileEmulation = {
    deviceMetrics: { width: 412, height: 839, pixelRatio: 2.625, touch: false, mobile: true },
    userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
};

/** Each platform's device pixel ratio, for a viewport resized through DevTools. */
export const PIXEL_RATIO: Record<Platform, number> = {
    desktop: 1,
    mobile: PIXEL_7.deviceMetrics.pixelRatio,
};

/**
 * A Chrome at the platform's screen.
 *
 * The app's build for this run (.env.e2e) signs in at https://auth.e2e.test, a
 * reserved name that resolves nowhere. Chrome is told to reach it at the Auth0
 * stand-in on 127.0.0.1 instead, and to take the stand-in's certificate, made
 * for the run, by its public key (`standInKey`, the SHA-256 of its SPKI in
 * base64) and no other certificate no authority signed. Chrome reads that list
 * only beside a profile of the session's own, which chromedriver gives each
 * session. Without the mapping the name still fails on DNS, so a stand-in that
 * stops answering can never send a test to a real tenant.
 */
export async function openBrowser(standInKey: string): Promise<WebDriver> {
    const options = chromeOptions();
    options.addArguments(
        `--host-resolver-rules=MAP ${AUTH0_DOMAIN} 127.0.0.1:${AUTH0_PORT}`,
        `--ignore-certificate-errors-spki-list=${standInKey}`,
    );
    if (platform === 'mobile') {
        // The window holds the phone's whole page; the emulation draws the
        // phone's viewport in it.
        options.windowSize({ width: 1280, height: 1000 });
        options.setMobileEmulation(PIXEL_7);
    } else {
        options.windowSize(DESKTOP);
    }
    const driver = await openChrome(options);
    try {
        await driver.manage().setTimeouts({ implicit: 0, pageLoad: 30_000, script: 30_000 });
        if (platform === 'desktop') await fitPage(driver);
        await asPlatform(driver);
    } catch (failure) {
        await driver.quit();
        throw failure;
    }
    return driver;
}

/**
 * The desktop's window grown until the page inside it is DESKTOP.
 *
 * Headless Chrome keeps part of the window for the browser's bars, which it
 * never draws, and how much differs by system: 200 px on macOS and 143 px on
 * the PR check's Linux runner, as Chrome 156 does it. A 1280×720 window left a
 * page 577 px tall on the runner, where the landing page's footer lay over the
 * sign-in button and took its clicks. The gap is measured rather than assumed,
 * as Brickfolio's harness does for Safari. Tabs opened later share the window.
 */
async function fitPage(driver: WebDriver): Promise<void> {
    const [inner, outer] = await driver.executeScript<[[number, number], [number, number]]>(
        'return [[innerWidth, innerHeight], [outerWidth, outerHeight]]',
    );
    await driver
        .manage()
        .window()
        .setRect({
            width: DESKTOP.width + outer[0] - inner[0],
            height: DESKTOP.height + outer[1] - inner[1],
        });
}

/**
 * The tab in view made the platform's, and checked, so a tab that isn't fails
 * here rather than testing another screen's page. On the phone, its touch
 * screen and coarse pointer, the mouse still a mouse, which DevTools sets for
 * each tab; its screen, which chromedriver's emulation gives each tab it opens.
 */
export async function asPlatform(driver: WebDriver): Promise<void> {
    if (platform === 'mobile') {
        await (driver as ChromeDriver).sendDevToolsCommand('Emulation.setTouchEmulationEnabled', {
            enabled: true,
        });
    }
    // The phone's screen rather than its page: a blank tab has no viewport
    // meta, so a phone lays it out 980 px wide, as it would a desktop site.
    // The desktop's page in both directions: a page short of DESKTOP's height
    // went unnoticed while only its width was checked (`fitPage`).
    const wanted =
        platform === 'mobile'
            ? {
                  width: PIXEL_7.deviceMetrics.width,
                  height: PIXEL_7.deviceMetrics.height,
                  ratio: PIXEL_7.deviceMetrics.pixelRatio,
              }
            : { ...DESKTOP, ratio: 1 };
    const [width, height, ratio] = await driver.executeScript<[number, number, number]>(
        platform === 'mobile'
            ? 'return [screen.width, screen.height, devicePixelRatio]'
            : 'return [innerWidth, innerHeight, devicePixelRatio]',
    );
    if (width !== wanted.width || height !== wanted.height || ratio !== wanted.ratio) {
        throw new Error(
            `The tab is ${width}×${height} px at ${ratio} pixels each, not the ${platform}'s ${wanted.width}×${wanted.height} px at ${wanted.ratio}`,
        );
    }
}
