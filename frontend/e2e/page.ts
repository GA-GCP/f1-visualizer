import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { error, type WebDriver, type WebElement } from 'selenium-webdriver';
import { PIXEL_RATIO, platform } from './browser';
import type { Driver as ChromeDriver } from 'selenium-webdriver/chrome';

/** The app under test: the e2e build, served by `vite preview` (e2e/servers.ts). */
export const WEB = 'http://127.0.0.1:4173';

/** Text to match: a string, whitespace collapsed, or a regular expression. */
export type Text = string | RegExp;

/** How long an action waits for its element to be there, shown and ready. */
const ACTION_MS = 15_000;
const POLL_MS = 100;

/** Not yet: an element not there, not one, or not ready. Waited out until the time is up. */
export class NotYet extends Error {}

/** Collapses whitespace as a reader sees it. */
export function collapse(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Whether `actual` is `expected`: a string's whitespace collapsed on both
 * sides, exactly or as a part of it, ignoring case; a regular expression tested
 * on the text as it is.
 */
export function matches(actual: string, expected: Text, exact: boolean): boolean {
    if (expected instanceof RegExp) return actual.search(expected) !== -1;
    if (exact) return collapse(actual) === collapse(expected);
    return collapse(actual).toLowerCase().includes(collapse(expected).toLowerCase());
}

/** What DevTools answers about a page that went on to another while it was read. */
const NAVIGATED =
    /Frame is detached|Cannot find context with specified id|Execution context was destroyed|No node with given id|does not belong to the document|Inspected target navigated or closed/;

/**
 * Whether a failure is the page in flux, waited out until the time is up: an
 * element not there, not one or not ready yet; an element the page replaced, or
 * covered for a moment (a menu's backdrop fading out); a page that went on to
 * another while it was read.
 */
export function inFlux(failure: unknown): boolean {
    return (
        failure instanceof NotYet ||
        failure instanceof error.StaleElementReferenceError ||
        failure instanceof error.NoSuchElementError ||
        failure instanceof error.ElementClickInterceptedError ||
        failure instanceof error.ElementNotInteractableError ||
        (failure instanceof error.WebDriverError && NAVIGATED.test(failure.message))
    );
}

/** Runs `attempt` until it succeeds or `ms` pass; then throws its last error. */
export async function retry<T>(attempt: () => Promise<T>, ms = ACTION_MS): Promise<T> {
    const until = Date.now() + ms;
    for (;;) {
        try {
            return await attempt();
        } catch (failure) {
            if (!inFlux(failure) || Date.now() >= until) throw failure;
        }
        await sleep(POLL_MS);
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A regular expression or a string, as a script in the page reads it. */
type PageText = { source: string; flags: string } | string;

function forPage(text: Text): PageText {
    return text instanceof RegExp ? { source: text.source, flags: text.flags } : text;
}

/**
 * The scripts run in the page, as strings: functions written in TypeScript
 * would be compiled with whatever helpers the compiler adds, which the page does
 * not have. Each takes its arguments as WebDriver passes them; `scopes` is an
 * array of elements to look within, or `[null]` for the document.
 */
const IN_PAGE = String.raw`
  const collapse = (text) => text.replace(/\s+/g, " ").trim();
  const matcher = (text, exact) => {
    if (typeof text !== "string") {
      const pattern = new RegExp(text.source, text.flags.replace("g", ""));
      return (value) => pattern.test(value);
    }
    const wanted = collapse(text);
    return exact
      ? (value) => collapse(value) === wanted
      : (value) => collapse(value).toLowerCase().includes(wanted.toLowerCase());
  };
  const inOrder = (elements) =>
    [...new Set(elements)].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  const within = (scopes, selector) =>
    inOrder(scopes.flatMap((scope) => [...(scope ?? document).querySelectorAll(selector)]));
  const hiddenFromReaders = (element) => {
    for (let node = element; node; node = node.parentElement) {
      if (node.getAttribute("aria-hidden") === "true" || node.inert) {
        return true;
      }
    }
    const box = getComputedStyle(element).display === "contents" ? element.parentElement : element;
    return box ? !box.checkVisibility({ visibilityProperty: true }) : false;
  };
`;

/**
 * The elements a role names before its name is read, by their tag or their
 * role attribute. A header is a banner only outside the sectioning elements.
 */
const ROLES: Record<string, string> = {
    alert: '[role="alert"]',
    banner: 'header:not([role]):not(article header, aside header, main header, nav header, section header), [role="banner"]',
    button: 'button:not([role]), input[type="button"]:not([role]), input[type="submit"]:not([role]), input[type="reset"]:not([role]), [role="button"]',
    checkbox: 'input[type="checkbox"]:not([role]), [role="checkbox"]',
    combobox:
        'select:not([role]):not([multiple]):not([size]), input[list]:not([role]), [role="combobox"]',
    dialog: 'dialog:not([role]), [role="dialog"]',
    heading:
        'h1:not([role]), h2:not([role]), h3:not([role]), h4:not([role]), h5:not([role]), h6:not([role]), [role="heading"]',
    img: 'img:not([role]):not([alt=""]), [role="img"]',
    link: 'a[href]:not([role]), area[href]:not([role]), [role="link"]',
    listbox: 'select[multiple]:not([role]), select[size]:not([role]), [role="listbox"]',
    main: 'main:not([role]), [role="main"]',
    navigation: 'nav:not([role]), [role="navigation"]',
    option: 'option:not([role]), [role="option"]',
    region: 'section:not([role]), [role="region"]',
    tab: '[role="tab"]',
};

/**
 * The elements of a role within the scopes, those hidden from assistive
 * technology left out, at the heading level asked for. Each comes with whether
 * its role holds only with a name (a section).
 */
const ROLE_SCRIPT = String.raw`${IN_PAGE}
  const [scopes, selector, level] = arguments;
  return within(scopes, selector)
    .filter((element) => !hiddenFromReaders(element))
    .filter((element) => {
      if (level === null) {
        return true;
      }
      const tag = /^H([1-6])$/.exec(element.tagName);
      return Number(element.getAttribute("aria-level") ?? (tag ? tag[1] : 2)) === level;
    })
    .map((element) => ({
      element,
      needsName: !element.hasAttribute("role") && element.tagName === "SECTION",
    }));
`;

/**
 * The innermost elements whose text, whitespace collapsed, holds the text asked
 * for: an element whose child holds it too gives way to that child. Text in
 * scripts, styles and templates is not read; text hidden on screen is.
 */
const TEXT_SCRIPT = String.raw`${IN_PAGE}
  const [scopes, text, exact] = arguments;
  const matched = matcher(text, exact);
  const unread = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD"]);
  const found = [];
  const walk = (element) => {
    if (unread.has(element.tagName)) {
      return false;
    }
    let inChild = false;
    for (const child of element.children) {
      inChild = walk(child) || inChild;
    }
    if (inChild) {
      return true;
    }
    if (matched(element.textContent ?? "")) {
      found.push(element);
      return true;
    }
    return false;
  };
  for (const scope of scopes) {
    for (const child of (scope ?? document.body).children) {
      walk(child);
    }
  }
  return inOrder(found);
`;

/**
 * The form controls labelled with the text: by the text of a label of theirs,
 * by the elements aria-labelledby names, or by aria-label. A MUI Select is a
 * combobox labelled by its InputLabel through aria-labelledby.
 */
const LABEL_SCRIPT = String.raw`${IN_PAGE}
  const [scopes, text, exact] = arguments;
  const matched = matcher(text, exact);
  const controls = within(
    scopes,
    'input:not([type="hidden"]), select, textarea, button, [contenteditable=""], [contenteditable="true"], [role]',
  );
  return controls.filter((control) => {
    const labels = [...(control.labels ?? [])].map((label) => label.textContent ?? "");
    const by = (control.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
    if (by.length) {
      labels.push(by.map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
    }
    const named = control.getAttribute("aria-label");
    if (named !== null) {
      labels.push(named);
    }
    return labels.some(matched);
  });
`;

const CSS_SCRIPT = String.raw`${IN_PAGE}
  const [scopes, selector] = arguments;
  return within(scopes, selector);
`;

/**
 * Whether the element is shown: a box with an area and visibility not hidden;
 * an element with display: contents is shown where something inside it is.
 * Opacity does not hide it.
 */
const VISIBLE_SCRIPT = String.raw`
  const shown = (element) => {
    const style = getComputedStyle(element);
    if (style.display === "contents") {
      return [...element.childNodes].some((node) =>
        node.nodeType === Node.TEXT_NODE ? node.textContent.trim() !== "" : node.nodeType === Node.ELEMENT_NODE && shown(node),
      );
    }
    if (style.visibility !== "visible") {
      return false;
    }
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  return shown(arguments[0]);
`;

const BOX_SCRIPT = String.raw`
  const box = arguments[0].getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
`;

/**
 * Every animation in the page brought to rest, as a still picture wants it: one
 * that ends is played to its end, and one that runs forever (a glow, a pulse)
 * is cancelled back to where it started.
 */
const STILL_SCRIPT = String.raw`
  for (const animation of document.getAnimations()) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
      animation.finish();
    } else {
      animation.cancel();
    }
  }
`;

export interface RoleOptions {
    name?: Text;
    exact?: boolean;
    level?: number;
}

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

type Step =
    | { kind: 'role'; role: string; options: RoleOptions }
    | { kind: 'text'; text: Text; exact: boolean }
    | { kind: 'label'; text: Text; exact: boolean }
    | { kind: 'css'; selector: string }
    | { kind: 'nth'; index: number };

/**
 * Elements found anew each time they are used, from the document down a chain
 * of steps: a role and its accessible name, as the browser computes it; text; a
 * label; a CSS selector; one by its place. An action on it waits for exactly
 * one element, shown.
 */
export class Locator {
    readonly page: Page;
    private readonly steps: readonly Step[];

    constructor(page: Page, steps: readonly Step[]) {
        this.page = page;
        this.steps = steps;
    }

    private and(step: Step): Locator {
        return new Locator(this.page, [...this.steps, step]);
    }

    getByRole(role: string, options: RoleOptions = {}): Locator {
        if (!ROLES[role]) throw new Error(`no selector for the role ${role}`);
        return this.and({ kind: 'role', role, options });
    }

    getByText(text: Text, options: { exact?: boolean } = {}): Locator {
        return this.and({ kind: 'text', text, exact: options.exact ?? false });
    }

    getByLabel(text: Text, options: { exact?: boolean } = {}): Locator {
        return this.and({ kind: 'label', text, exact: options.exact ?? false });
    }

    locator(selector: string): Locator {
        return this.and({ kind: 'css', selector });
    }

    first(): Locator {
        return this.nth(0);
    }

    nth(index: number): Locator {
        return this.and({ kind: 'nth', index });
    }

    /** Every element the chain finds now, in document order. */
    async all(): Promise<WebElement[]> {
        let found: (WebElement | null)[] = [null];
        for (const step of this.steps) found = await this.page.find(step, found);
        return found.filter((element): element is WebElement => element !== null);
    }

    async count(): Promise<number> {
        return (await this.all()).length;
    }

    /** The one element found now; not yet if there is none, or more than one. */
    async one(): Promise<WebElement> {
        const found = await this.all();
        if (found.length !== 1)
            throw new NotYet(`${this.describe()} found ${found.length} elements, not one`);
        return found[0];
    }

    describe(): string {
        return this.steps
            .map((step) => {
                switch (step.kind) {
                    case 'role':
                        return `role ${step.role}${step.options.name === undefined ? '' : ` named ${String(step.options.name)}`}`;
                    case 'text':
                        return `text ${String(step.text)}`;
                    case 'label':
                        return `label ${String(step.text)}`;
                    case 'css':
                        return step.selector;
                    case 'nth':
                        return `#${step.index}`;
                }
            })
            .join(' > ');
    }

    /** Waits for the one element, shown, and clicks its middle. */
    async click(): Promise<void> {
        await retry(async () => {
            const element = await this.one();
            if (!(await this.page.visible(element)))
                throw new NotYet(`${this.describe()} is not shown`);
            await element.click();
        });
    }

    /** The element's box in the window, as getBoundingClientRect has it. */
    async boundingBox(): Promise<Box> {
        return retry(async () => this.page.box(await this.one()));
    }

    /** Runs a script with the element as arguments[0], and `arg` as arguments[1]. */
    async evaluate<T>(script: string, arg?: unknown): Promise<T> {
        return retry(async () => this.page.driver.executeScript<T>(script, await this.one(), arg));
    }
}

/**
 * One browser's page for one test, over Selenium WebDriver: the app's
 * addresses, its elements by role, text, label or CSS, and DevTools' emulation
 * of the viewport.
 */
export class Page {
    readonly driver: WebDriver;

    constructor(driver: WebDriver) {
        this.driver = driver;
    }

    /** Goes to a path of the app, or an address, and waits for the page to load. */
    async goto(path: string): Promise<void> {
        await this.driver.get(path.startsWith('http') ? path : `${WEB}${path}`);
    }

    async url(): Promise<string> {
        return this.driver.getCurrentUrl();
    }

    async title(): Promise<string> {
        return this.driver.getTitle();
    }

    /** Runs a script in the page; its arguments are arguments[0] on. */
    async evaluate<T>(script: string, ...args: unknown[]): Promise<T> {
        return this.driver.executeScript<T>(script, ...args);
    }

    getByRole(role: string, options: RoleOptions = {}): Locator {
        return new Locator(this, []).getByRole(role, options);
    }

    getByText(text: Text, options: { exact?: boolean } = {}): Locator {
        return new Locator(this, []).getByText(text, options);
    }

    getByLabel(text: Text, options: { exact?: boolean } = {}): Locator {
        return new Locator(this, []).getByLabel(text, options);
    }

    locator(selector: string): Locator {
        return new Locator(this, []).locator(selector);
    }

    /** One step of a locator, from the elements the steps before it found. */
    async find(step: Step, scopes: (WebElement | null)[]): Promise<(WebElement | null)[]> {
        switch (step.kind) {
            case 'role':
                return this.byRole(step.role, step.options, scopes);
            case 'text':
                return this.driver.executeScript(
                    TEXT_SCRIPT,
                    scopes,
                    forPage(step.text),
                    step.exact,
                );
            case 'label':
                return this.driver.executeScript(
                    LABEL_SCRIPT,
                    scopes,
                    forPage(step.text),
                    step.exact,
                );
            case 'css':
                return this.driver.executeScript(CSS_SCRIPT, scopes, step.selector);
            case 'nth': {
                const one = scopes[step.index];
                return one ? [one] : [];
            }
        }
    }

    /** The elements of a role, their names as the browser computes them. */
    private async byRole(
        role: string,
        options: RoleOptions,
        scopes: (WebElement | null)[],
    ): Promise<WebElement[]> {
        const candidates = await this.driver.executeScript<
            { element: WebElement; needsName: boolean }[]
        >(ROLE_SCRIPT, scopes, ROLES[role], options.level ?? null);
        const kept: WebElement[] = [];
        for (const { element, needsName } of candidates) {
            if (options.name === undefined && !needsName) {
                kept.push(element);
                continue;
            }
            const name = await element.getAccessibleName();
            if (needsName && !name.trim()) continue;
            if (options.name === undefined || matches(name, options.name, options.exact ?? false))
                kept.push(element);
        }
        return kept;
    }

    async visible(element: WebElement): Promise<boolean> {
        return this.driver.executeScript<boolean>(VISIBLE_SCRIPT, element);
    }

    async box(element: WebElement): Promise<Box> {
        return this.driver.executeScript<Box>(BOX_SCRIPT, element);
    }

    /** The page's own width and height, in CSS pixels. */
    async viewportSize(): Promise<{ width: number; height: number }> {
        const [width, height] = await this.evaluate<[number, number]>(
            'return [innerWidth, innerHeight]',
        );
        return { width, height };
    }

    /** Resizes the page the platform draws, through DevTools, at the platform's pixel ratio. */
    async setViewportSize(size: { width: number; height: number }): Promise<void> {
        await (this.driver as ChromeDriver).sendDevToolsCommand(
            'Emulation.setDeviceMetricsOverride',
            {
                ...size,
                deviceScaleFactor: PIXEL_RATIO[platform],
                mobile: platform === 'mobile',
            },
        );
    }

    /** Brings every animation in the page to rest (STILL_SCRIPT). */
    async still(): Promise<void> {
        await this.evaluate(STILL_SCRIPT);
    }

    /** What the page shows, at its device pixels, written as a PNG. */
    async screenshot(path: string): Promise<void> {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, await this.driver.takeScreenshot(), 'base64');
    }
}
