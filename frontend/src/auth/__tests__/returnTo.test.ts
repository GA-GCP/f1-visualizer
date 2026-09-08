import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN_TO, safeReturnTo } from '../returnTo';

describe('safeReturnTo', () => {
    it('keeps a same-origin path, including its query', () => {
        expect(safeReturnTo('/historical?session=9001')).toBe('/historical?session=9001');
    });

    it.each([
        ['https://evil.test/steal', 'an absolute URL'],
        ['//evil.test/steal', 'a protocol-relative URL that startsWith("/") accepts'],
        ['/\\evil.test', 'a backslash variant some parsers read as scheme-relative'],
        ['javascript:alert(1)', 'a javascript: URL'],
        ['', 'an empty string'],
    ])('refuses %s (%s)', (input) => {
        expect(safeReturnTo(input)).toBe(DEFAULT_RETURN_TO);
    });

    it('falls back when there is nothing to return to', () => {
        expect(safeReturnTo(undefined)).toBe(DEFAULT_RETURN_TO);
        expect(safeReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    });
});
