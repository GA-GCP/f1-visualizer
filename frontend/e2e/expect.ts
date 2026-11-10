import { type Assertion, expect as vitestExpect } from 'vitest';
import { inFlux, Locator, matches, Page, type Text, WEB } from './page';

/** How long a check waits for the page to come to what it expects. */
const EXPECT_MS = 5_000;
const POLL_MS = 100;

interface Wait {
    timeout?: number;
}

interface Reading {
    pass: boolean;
    actual: unknown;
}

function show(value: unknown): string {
    return value instanceof RegExp ? String(value) : JSON.stringify(value);
}

/**
 * Reads the page until what it reads is as expected, or, under `not`, is not;
 * then reports. An element not there, more than one where one is meant, or a
 * page in flux (an element replaced, a page gone on to another as it was read)
 * reads as not as expected.
 */
async function settle(
    negated: boolean,
    wait: Wait,
    read: () => Promise<Reading>,
    expectation: string,
): Promise<void> {
    const until = Date.now() + (wait.timeout ?? EXPECT_MS);
    let last: Reading;
    for (;;) {
        try {
            last = await read();
        } catch (failure) {
            if (!inFlux(failure)) throw failure;
            last = {
                pass: false,
                actual: failure instanceof Error ? failure.message : String(failure),
            };
        }
        if (last.pass !== negated || Date.now() >= until) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    if (last.pass === negated) {
        throw new Error(
            `Expected ${negated ? 'not ' : ''}${expectation}; it is ${show(last.actual)}, after ${wait.timeout ?? EXPECT_MS} ms`,
        );
    }
}

/** Checks on elements, each waiting for the page to come to it. */
export class LocatorExpectation {
    private readonly locator: Locator;
    private readonly negated: boolean;

    constructor(locator: Locator, negated = false) {
        this.locator = locator;
        this.negated = negated;
    }

    get not(): LocatorExpectation {
        return new LocatorExpectation(this.locator, !this.negated);
    }

    private settle(wait: Wait, read: () => Promise<Reading>, expectation: string): Promise<void> {
        return settle(this.negated, wait, read, `${this.locator.describe()} ${expectation}`);
    }

    /** One element, drawn with an area and not hidden. */
    toBeVisible(options: Wait = {}): Promise<void> {
        return this.settle(
            options,
            async () => {
                const found = await this.locator.all();
                if (found.length !== 1) return { pass: false, actual: `${found.length} elements` };
                const pass = await this.locator.page.visible(found[0]);
                return { pass, actual: pass ? 'shown' : 'not shown' };
            },
            'to be shown',
        );
    }

    toHaveCount(count: number, options: Wait = {}): Promise<void> {
        return this.settle(
            options,
            async () => {
                const actual = await this.locator.count();
                return { pass: actual === count, actual };
            },
            `to find ${count} elements`,
        );
    }
}

/** Checks on the page as a whole, each waiting for the page to come to it. */
export class PageExpectation {
    private readonly page: Page;
    private readonly negated: boolean;

    constructor(page: Page, negated = false) {
        this.page = page;
        this.negated = negated;
    }

    get not(): PageExpectation {
        return new PageExpectation(this.page, !this.negated);
    }

    /**
     * The address: a string exactly, a path resolved from the app's address
     * first; a regular expression as it is.
     */
    toHaveURL(expected: Text, options: Wait = {}): Promise<void> {
        const wanted = expected instanceof RegExp ? expected : new URL(expected, WEB).href;
        return settle(
            this.negated,
            options,
            async () => {
                const actual = await this.page.url();
                const pass =
                    wanted instanceof RegExp ? matches(actual, wanted, true) : actual === wanted;
                return { pass, actual };
            },
            `the page to be at ${show(wanted)}`,
        );
    }
}

function expectOf(actual: Locator): LocatorExpectation;
function expectOf(actual: Page): PageExpectation;
function expectOf<T>(actual: T): Assertion<void, T>;
function expectOf(
    actual: unknown,
): LocatorExpectation | PageExpectation | Assertion<void, unknown> {
    if (actual instanceof Locator) return new LocatorExpectation(actual);
    if (actual instanceof Page) return new PageExpectation(actual);
    return vitestExpect(actual);
}

/**
 * Vitest's expect, with checks of its own for the page and its elements that
 * wait for the page to come to what they expect:
 * `await expect(page.getByRole('main')).toBeVisible()`.
 */
const poll: typeof vitestExpect.poll = (actual, options) => vitestExpect.poll(actual, options);

export const expect = Object.assign(expectOf, { poll });
