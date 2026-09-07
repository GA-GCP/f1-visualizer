import { describe, it, expect, vi, afterEach } from 'vitest';
import * as z from 'zod/mini';
import { parseResponse, SchemaMismatchError } from '../parseResponse';
import { driverProfileSchema, telemetryPacketSchema } from '../schemas';

const schema = z.object({ id: z.number(), code: z.string() });

describe('parseResponse', () => {
    afterEach(() => vi.restoreAllMocks());

    it('returns the parsed value when the shape matches', () => {
        expect(parseResponse(schema, { id: 1, code: 'VER' }, 'test')).toEqual({ id: 1, code: 'VER' });
    });

    it('throws a distinguishable error when the contract has drifted', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // A backend rename used to pass tsc, pass every test (they mock the
        // API) and fail only in production as NaN on the canvas.
        expect(() => parseResponse(schema, { id: 1, driverCode: 'VER' }, 'GET /drivers'))
            .toThrow(SchemaMismatchError);
    });

    it('names the endpoint in the error so the drift is locatable', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            parseResponse(schema, {}, 'GET /analysis/drivers');
            expect.unreachable();
        } catch (error) {
            expect((error as SchemaMismatchError).context).toBe('GET /analysis/drivers');
        }
    });

    it('rejects a wrong primitive type, not just a missing key', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // The old hand-rolled GPS guard checked three keys for presence only, so
        // a string x sailed through and landed as NaN.
        expect(() => parseResponse(schema, { id: '1', code: 'VER' }, 'test'))
            .toThrow(SchemaMismatchError);
    });
});

describe('wire schemas', () => {
    it('accepts a complete telemetry packet', () => {
        const packet = {
            session_key: 9165, meeting_key: 1, date: '2024-05-01T12:00:00Z',
            driver_number: 1, speed: 300, rpm: 11000, gear: 7, throttle: 100, brake: 0, drs: 0,
        };
        expect(z.safeParse(telemetryPacketSchema, packet).success).toBe(true);
    });

    it('tolerates extra fields, so an additive backend change is not a break', () => {
        const packet = {
            session_key: 9165, meeting_key: 1, date: '2024-05-01T12:00:00Z',
            driver_number: 1, speed: 300, rpm: 11000, gear: 7, throttle: 100, brake: 0, drs: 0,
            newFieldTheBackendAdded: true,
        };
        expect(z.safeParse(telemetryPacketSchema, packet).success).toBe(true);
    });

    it('rejects a driver profile missing its stats block', () => {
        expect(z.safeParse(driverProfileSchema, {
            id: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', teamColor: '3671C6',
        }).success).toBe(false);
    });
});
