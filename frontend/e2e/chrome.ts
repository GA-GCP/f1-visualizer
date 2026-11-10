import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { arch, env, platform } from 'node:process';
import { Browser, Builder, type WebDriver } from 'selenium-webdriver';
// Node runs this file as it is, and selenium-webdriver has no exports map, so
// Node finds its subpaths only by their file names.
// eslint-disable-next-line import-x/extensions
import { Options, ServiceBuilder } from 'selenium-webdriver/chrome.js';

/**
 * The Chrome for Testing milestone the browser tests and the screenshots run
 * in, except on the PR check's runners, which drive the Chrome their image
 * installs (see `chromeHere`). Run as a script (`pnpm e2e:chrome`), this file
 * has Selenium Manager fetch it and its chromedriver into its cache,
 * ~/.cache/selenium, from Chrome for Testing's own storage; what is there
 * already is used as it is. Each computer runs it once; the tests find it there
 * offline and fetch nothing. A new milestone is a change here, and a fetch.
 *
 * Node runs this file as it is (it imports nothing of the app's), and so does
 * e2e/screenshots.compose.ts, which imports it.
 */
export const CHROME_MILESTONE = '155';

const require = createRequire(import.meta.url);

/** Selenium Manager, as selenium-webdriver ships it for this system. */
function seleniumManager(): string {
    const root = dirname(require.resolve('selenium-webdriver/package.json'));
    const folder =
        platform === 'darwin'
            ? 'macos'
            : platform === 'win32'
              ? 'windows'
              : arch === 'arm64'
                ? 'linux-arm64'
                : 'linux-x86_64';
    return join(
        root,
        'bin',
        folder,
        platform === 'win32' ? 'selenium-manager.exe' : 'selenium-manager',
    );
}

interface ManagerResult {
    result: { code: number; message: string; driver_path?: string; browser_path?: string };
}

/**
 * Chrome for Testing at the milestone, and its chromedriver, as Selenium
 * Manager finds them. With `offline`, it looks only in its cache and fetches
 * nothing; without, it fetches what is missing. Neither sends its usage
 * statistics.
 */
export function chromeFor(offline: boolean): { browser: string; driver: string } {
    const args = ['--browser', 'chrome', '--browser-version', CHROME_MILESTONE];
    args.push('--avoid-stats', '--output', 'json', ...(offline ? ['--offline'] : []));
    const run = spawnSync(seleniumManager(), args, { encoding: 'utf8' });
    let output: ManagerResult;
    try {
        output = JSON.parse(run.stdout) as ManagerResult;
    } catch {
        throw new Error(`Selenium Manager wrote no answer: ${run.stderr || run.error?.message}`);
    }
    const { code, message, browser_path: browser, driver_path: driver } = output.result;
    if (run.status !== 0 || code !== 0 || !browser || !driver) {
        throw new Error(
            `Chrome for Testing ${CHROME_MILESTONE} is not ready (${message}). ` +
                '`pnpm e2e:chrome` fetches it.',
        );
    }
    return { browser, driver };
}

/**
 * Chrome and its chromedriver. On GitHub's runners, those the runner's image
 * installs: CHROMEWEBDRIVER names its chromedriver's folder, and chromedriver
 * finds the image's Chrome itself, so nothing is fetched and the version moves
 * with the image's. Elsewhere, Chrome for Testing at CHROME_MILESTONE, from
 * Selenium Manager's cache.
 */
function chromeHere(): { browser?: string; driver: string } {
    const runner = env.CHROMEWEBDRIVER;
    return runner ? { driver: join(runner, 'chromedriver') } : chromeFor(true);
}

let paths: { browser?: string; driver: string } | undefined;

/**
 * Chrome's options before anything is asked of it: headless, no first-run
 * screens, no scrollbar thumbs drawn over a screenshot's right edge, and on
 * Linux no sandbox, which needs user namespaces the runner's image may
 * restrict. Every page a test opens is the app's own or a stand-in's, on
 * 127.0.0.1.
 */
export function chromeOptions(): Options {
    paths ??= chromeHere();
    const options = new Options();
    if (paths.browser) options.setChromeBinaryPath(paths.browser);
    options.addArguments(
        '--headless',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
    );
    if (platform === 'linux') options.addArguments('--no-sandbox');
    return options;
}

/** A Chrome with the options, driven by its own chromedriver. */
export function openChrome(options: Options): Promise<WebDriver> {
    paths ??= chromeHere();
    return new Builder()
        .forBrowser(Browser.CHROME)
        .setChromeOptions(options)
        .setChromeService(new ServiceBuilder(paths.driver))
        .build();
}

if (import.meta.main) {
    const { browser, driver } = chromeFor(false);
    console.log(`Chrome for Testing ${CHROME_MILESTONE}: ${browser}`);
    console.log(`chromedriver: ${driver}`);
}
