import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Node runs this file as it is, and Node resolves no import without its extension.
// eslint-disable-next-line import-x/extensions
import { chromeOptions, openChrome } from './chrome.ts';
import type { Driver as ChromeDriver } from 'selenium-webdriver/chrome';

/** docs/screenshots at the repository root, wherever Node is launched from. */
const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));

const dataUri = (name: string): string =>
    `data:image/png;base64,${readFileSync(`${OUT}${name}`).toString('base64')}`;

/**
 * The README's lead image: the desktop Live Console in a browser-window frame
 * with the Pixel 7 capture in a phone bezel over its bottom-right corner, the
 * way the portfolio's project gallery presents it. GitHub strips the CSS that
 * would draw this around two separate images, so it is composed here instead,
 * from the two captures e2e/screenshots.capture.ts wrote.
 *
 * The desktop capture is laid out at half its width and rendered at 2x, so it
 * keeps every captured pixel while the frame keeps the proportions it has on
 * the portfolio. The background is transparent, for GitHub's light and dark
 * themes alike.
 *
 *   pnpm screenshots:compose
 */
const PAGE = `<!doctype html>
<style>
  body { margin: 0; background: transparent; }
  .canvas { display: inline-block; padding: 24px 48px 64px 24px; }
  .stage { position: relative; width: 720px; }
  .window {
    overflow: hidden; border-radius: 12px; background: #0b0b0b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.7);
  }
  .bar {
    display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px;
    background: #161616; border-bottom: 1px solid #1f1f1f;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; opacity: 0.85; }
  .address { flex: 0 1 40%; height: 12px; margin: 0 auto; border-radius: 6px; background: #1d1d1d; }
  .spacer { width: 39px; }
  .window img { display: block; width: 720px; height: 500px; }
  .phone {
    position: absolute; right: -2.5%; bottom: -5%; height: 62%; padding: 5px;
    border-radius: 18px; background: #0b0b0b;
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: 0 24px 40px -12px rgba(0, 0, 0, 0.8);
  }
  .phone img { display: block; height: 100%; aspect-ratio: 1082 / 2202; border-radius: 13px; }
</style>
<div class="canvas">
  <div class="stage">
    <div class="window">
      <div class="bar">
        <div class="dot" style="background:#ff5f57"></div>
        <div class="dot" style="background:#febc2e"></div>
        <div class="dot" style="background:#28c840"></div>
        <div class="address"></div>
        <div class="spacer"></div>
      </div>
      <img src="${dataUri('live-console.png')}" alt="" />
    </div>
    <div class="phone"><img src="${dataUri('live-console-mobile.png')}" alt="" /></div>
  </div>
</div>`;

/** A box in the page, in CSS pixels. */
interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

const driver = (await openChrome(chromeOptions())) as ChromeDriver;
try {
    // A page at 2 pixels each, drawn over nothing: what the page leaves
    // unpainted stays transparent in the capture.
    await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', {
        width: 820,
        height: 680,
        deviceScaleFactor: 2,
        mobile: false,
    });
    await driver.sendDevToolsCommand('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
    });
    // Written into a blank page rather than navigated to: the two captures
    // inlined make the page larger than Chrome takes as a data: address.
    await driver.get('about:blank');
    await driver.executeScript(
        'document.open(); document.write(arguments[0]); document.close();',
        PAGE,
    );
    const box = await driver.executeScript<Box>(String.raw`
        return Promise.all([...document.images].map((img) => img.decode())).then(() => {
            const box = document.querySelector(".canvas").getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
        });
    `);
    // selenium-webdriver's types say a string; chromedriver answers the
    // command's result as DevTools gives it.
    const capture = (await driver.sendAndGetDevToolsCommand('Page.captureScreenshot', {
        format: 'png',
        clip: { ...box, scale: 1 },
    })) as unknown as { data: string };
    writeFileSync(`${OUT}live-console-showcase.png`, capture.data, 'base64');
    console.log(`${OUT}live-console-showcase.png`);
} finally {
    await driver.quit();
}
