import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger, setErrorSink } from '../logger';

describe('createLogger', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        setErrorSink(null);
    });

    it('tags every line with its scope', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        createLogger('stomp').warn('socket closed', { code: 1006 });

        expect(spy).toHaveBeenCalledWith('[stomp] socket closed', { code: 1006 });
    });

    it('routes errors to the sink as well as the console', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const sink = vi.fn();
        setErrorSink(sink);

        createLogger('api').error('request failed', 500);

        expect(sink).toHaveBeenCalledWith(
            expect.objectContaining({ level: 'error', scope: 'api', message: 'request failed' }),
        );
    });

    it('does not send warnings to the error sink', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const sink = vi.fn();
        setErrorSink(sink);

        createLogger('api').warn('retrying');

        expect(sink).not.toHaveBeenCalled();
    });

    it('survives a sink that throws, so reporting cannot break the caller', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        setErrorSink(() => {
            throw new Error('sink is down');
        });

        expect(() => createLogger('api').error('request failed')).not.toThrow();
    });
});
