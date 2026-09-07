import * as z from 'zod/mini';

/**
 * Raised when a response does not match the schema the client expects.
 *
 * Distinct from a transport failure: this means the backend contract has moved,
 * and it should be loud. Previously such a change passed `tsc -b`, passed every
 * test (they mock the API), and surfaced only in production as NaN coordinates
 * on the canvas or an empty radar.
 */
export class SchemaMismatchError extends Error {
    readonly context: string;
    readonly issues: unknown;

    constructor(context: string, issues: unknown) {
        super(`Response did not match the expected shape for ${context}`);
        this.name = 'SchemaMismatchError';
        this.context = context;
        this.issues = issues;
    }
}

/** Validates a response body, throwing a SchemaMismatchError if it has drifted. */
export function parseResponse<T>(schema: z.ZodMiniType<T>, data: unknown, context: string): T {
    const result = z.safeParse(schema, data);
    if (!result.success) {
        console.error(`[API] ${context} — unexpected response shape`, result.error.issues);
        throw new SchemaMismatchError(context, result.error.issues);
    }
    return result.data;
}
