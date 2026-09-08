import { describe, expect, it, vi } from 'vitest';
import { buildInfo, publishBuildInfo } from '../buildInfo';

describe('buildInfo', () => {
    it('carries the values substituted at build time', () => {
        // Asserted as properties rather than as literals. These used to be
        // pinned to 'test', a value that existed only because vitest.config.ts
        // carried its own copy of the `define` — the exact config drift that
        // merging the two configs removed. What actually matters is that the
        // substitution happened at all: an unsubstituted __APP_VERSION__ is a
        // ReferenceError, and an empty one is a build nobody can identify.
        expect(buildInfo.version).toBeTypeOf('string');
        expect(buildInfo.version.length).toBeGreaterThan(0);
        expect(Number.isNaN(Date.parse(buildInfo.buildTime))).toBe(false);
        expect(buildInfo.mode).toBeTypeOf('string');
    });

    it('publishes a global support can read from the address bar', () => {
        const target = {} as Window;
        publishBuildInfo(target);

        expect((target as Window & { __F1V__?: typeof buildInfo }).__F1V__).toEqual(buildInfo);
    });

    it('logs the identity at info, which survives the production level gate', () => {
        // The scoped logger drops info outside DEV. This one line is the whole
        // point of the finding, so it goes to console.info directly — if it is
        // ever moved onto the logger it stops appearing in production.
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        publishBuildInfo({} as Window);

        expect(info).toHaveBeenCalledOnce();
        // Against buildInfo.version, not a literal: 'test' would still match
        // here via the MODE segment of the same line, so the assertion would
        // pass while saying nothing about the version.
        expect(info.mock.calls[0][0]).toContain(buildInfo.version);
        expect(info.mock.calls[0][0]).toContain(buildInfo.buildTime);
    });
});
