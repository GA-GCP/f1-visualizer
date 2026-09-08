import { describe, expect, it, vi } from 'vitest';
import { buildInfo, publishBuildInfo } from '../buildInfo';

describe('buildInfo', () => {
    it('carries the values substituted at build time', () => {
        // vitest.config.ts defines these; in production they come from
        // APP_VERSION / SOURCE_DATE_EPOCH via vite.config.ts.
        expect(buildInfo.version).toBe('test');
        expect(buildInfo.buildTime).toBe('1970-01-01T00:00:00.000Z');
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
        expect(info.mock.calls[0][0]).toContain('test');
    });
});
