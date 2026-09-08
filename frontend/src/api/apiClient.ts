import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('api');

export const apiClient = axios.create({
    baseURL: env.apiBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
    // Without a timeout an abandoned request hangs indefinitely and — through
    // the retry policy below — keeps retrying against a service that is not
    // answering.
    timeout: 15_000,
    timeoutErrorMessage: 'API timeout',
});

/**
 * Raised when a request could not be authenticated and re-authentication is the
 * only way forward.
 *
 * Callers should let this propagate rather than rendering it as a data error:
 * an expired session and an outage are not the same failure, and the app used
 * to present them identically.
 */
export class AuthExpiredError extends Error {
    constructor(message = 'Session expired') {
        super(message);
        this.name = 'AuthExpiredError';
    }
}

/** Fetches a token, bypassing the cache. Registered by AxiosAuthInterceptor. */
let refreshAccessToken: (() => Promise<string>) | null = null;
/** Starts an interactive login. Registered by AxiosAuthInterceptor. */
let onAuthExpired: (() => void) | null = null;

export function setAuthHandlers(handlers: {
    refreshAccessToken: (() => Promise<string>) | null;
    onAuthExpired: (() => void) | null;
}): void {
    refreshAccessToken = handlers.refreshAccessToken;
    onAuthExpired = handlers.onAuthExpired;
}

/** Widened config: axios carries our retry bookkeeping on the request config. */
interface RetryConfig extends InternalAxiosRequestConfig {
    _attempt?: number;
    _authRetried?: boolean;
    /** Opt in for a non-idempotent call that carries an Idempotency-Key. */
    idempotent?: boolean;
}

/**
 * Methods safe to replay. POST is deliberately absent: the old policy retried
 * on network errors without checking the method, so an ingestion command or a
 * preferences write could be applied up to three times.
 */
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);

/** Statuses worth another attempt. 502/503/504 are Cloud Run cold starts and
 *  gateway restarts, and were previously not retried at all. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Parses Retry-After, which RFC 9110 allows to be either a delay in seconds or
 * an HTTP-date. The old code used parseInt, which yields NaN for a date and so
 * silently produced a NaN delay.
 */
export function retryAfterMs(header?: string): number | undefined {
    if (!header) return undefined;

    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0) * 1000, MAX_RETRY_DELAY_MS);

    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), MAX_RETRY_DELAY_MS));

    return undefined;
}

apiClient.interceptors.response.use(
    (response) => response,
    // Typed rather than left as axios's implicit `any`: the body already cast
    // to AxiosError in four places to read .response and .code, so the `any`
    // bought nothing and hid the rest. Rejecting with a typed error also means
    // the rejection reason is provably an Error.
    async (error: AxiosError) => {
        const config = error.config;

        // A 401 used to only produce a console warning: the request failed, the
        // page showed a generic data error, and isAuthenticated stayed true, so
        // the app carried on issuing credential-less requests with no way back
        // except a manual reload.
        //
        // One retry with a freshly-minted token covers the ordinary case (the
        // cached token expired mid-flight). If that fails, the session is gone:
        // fail closed, hand control to the interactive login, and reject with a
        // distinguishable error rather than a generic one.
        if (error.response?.status === 401 && config) {
            const retryConfig = config as RetryConfig;
            if (!retryConfig._authRetried && refreshAccessToken) {
                retryConfig._authRetried = true;
                try {
                    const token = await refreshAccessToken();
                    // Spreading into an object literal used to replace the
                    // AxiosHeaders instance with a plain object that no longer
                    // had its methods; it worked only because axios
                    // re-normalises downstream, and the untyped `error` is what
                    // kept that from ever being a type error.
                    //
                    // `AxiosHeaders.from` rather than calling .set directly:
                    // real axios always hands the interceptor an instance, but
                    // it costs nothing to accept a plain object too, and
                    // assuming otherwise makes the retry path throw inside its
                    // own try/catch and fail closed for the wrong reason.
                    config.headers = AxiosHeaders.from(config.headers);
                    config.headers.set('Authorization', `Bearer ${token}`);
                    return await apiClient(config);
                } catch {
                    // fall through to re-authentication
                }
            }
            onAuthExpired?.();
            return Promise.reject(new AuthExpiredError());
        }

        // One retry policy, applied only to requests that are safe to replay.
        //
        // Previously there were two ad-hoc branches: a 429 branch, and a
        // network-error branch that never checked the method — so a POST could
        // be replayed three times — and neither covered 502/503/504 or a
        // timeout, which are exactly the Cloud Run cold-start failures.
        const retryConfig = config as RetryConfig | undefined;
        if (!retryConfig) return Promise.reject(error);

        const status = error.response?.status;
        const code = error.code;
        const isTransient =
            (status !== undefined && RETRYABLE_STATUSES.has(status))
            || code === 'ERR_NETWORK'
            || code === 'ECONNABORTED'; // the instance timeout above

        const method = (retryConfig.method ?? 'get').toLowerCase();
        const isSafeToReplay = IDEMPOTENT_METHODS.has(method) || retryConfig.idempotent === true;

        retryConfig._attempt = (retryConfig._attempt ?? 0) + 1;

        if (
            !isTransient
            || !isSafeToReplay
            || retryConfig._attempt > MAX_ATTEMPTS
            // The caller has walked away; do not keep the request alive.
            || retryConfig.signal?.aborted
        ) {
            return Promise.reject(error);
        }

        const serverDelay = retryAfterMs(
            error.response?.headers?.['retry-after'] as string | undefined,
        );
        const backoff = serverDelay ?? 500 * 2 ** retryConfig._attempt;
        // Full jitter: without it, every client that failed together retries
        // together and rebuilds the burst that caused the failure.
        const delayMs = Math.round(backoff * (0.5 + Math.random()));

        log.warn(
            `[API] ${status ?? code} on ${method.toUpperCase()} ${retryConfig.url ?? ''} — `
            + `retrying in ${delayMs}ms (attempt ${retryConfig._attempt}/${MAX_ATTEMPTS})`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return apiClient(retryConfig);
    }
);

/** True when a rejection is a deliberate cancellation rather than a failure. */
export function isRequestCancelled(error: unknown): boolean {
    return axios.isCancel(error);
}

/**
 * Makes a shared, de-duplicated request abortable *per caller*.
 *
 * The caller's promise rejects when its signal fires, but the underlying
 * request keeps running for everyone else waiting on it — passing the signal
 * to axios directly would cancel the shared request and break them.
 */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new axios.CanceledError('Request aborted'));

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new axios.CanceledError('Request aborted'));
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(resolve, reject).finally(() => {
            signal.removeEventListener('abort', onAbort);
        });
    });
}
