export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Debug and info are dropped outside DEV. Previously every console call site
 * ran in production at whatever volume the code happened to produce — including
 * per-packet logging on the live feed.
 */
const minimumLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

export interface LogEntry {
    level: LogLevel;
    scope: string;
    message: string;
    details: unknown[];
}

/**
 * Where errors go besides the console.
 *
 * Deliberately a seam rather than a hard dependency: wiring Sentry or GCP Error
 * Reporting is a deployment decision, and this is the single place it attaches.
 */
let errorSink: ((entry: LogEntry) => void) | null = null;

export function setErrorSink(sink: ((entry: LogEntry) => void) | null): void {
    errorSink = sink;
}

export interface Logger {
    debug(message: string, ...details: unknown[]): void;
    info(message: string, ...details: unknown[]): void;
    warn(message: string, ...details: unknown[]): void;
    error(message: string, ...details: unknown[]): void;
}

const CONSOLE_METHOD: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
    debug: 'debug', info: 'info', warn: 'warn', error: 'error',
};

/**
 * A logger tagged with a scope, e.g. `createLogger('STOMP')`.
 *
 * Replaces bare console calls so that level gating, the production error sink
 * and the scope prefix are decided in one place rather than 40.
 */
export function createLogger(scope: string): Logger {
    const emit = (level: LogLevel, message: string, details: unknown[]) => {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) return;

        console[CONSOLE_METHOD[level]](`[${scope}] ${message}`, ...details);

        if (level === 'error' && errorSink) {
            try {
                errorSink({ level, scope, message, details });
            } catch {
                // A failing sink must never break the code that was reporting.
            }
        }
    };

    return {
        debug: (message, ...details) => emit('debug', message, details),
        info: (message, ...details) => emit('info', message, details),
        warn: (message, ...details) => emit('warn', message, details),
        error: (message, ...details) => emit('error', message, details),
    };
}
