import axios from 'axios';

let targetBaseUrl = '/api/v1'; // Default for local 'development' (uses Vite proxy)

if (import.meta.env.MODE === 'prod') {
    targetBaseUrl = 'https://api.f1visualizer.com/api/v1';
} else if (import.meta.env.MODE === 'uat') {
    targetBaseUrl = 'https://uat.api.f1visualizer.com/api/v1';
} else if (import.meta.env.MODE === 'dev') {
    targetBaseUrl = 'https://dev.api.f1visualizer.com/api/v1';
}

export const apiClient = axios.create({
    baseURL: targetBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
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
interface RetryConfig {
    _retryCount?: number;
    _networkRetryCount?: number;
    _authRetried?: boolean;
    headers?: Record<string, string>;
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
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
                    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
                    return await apiClient(config);
                } catch {
                    // fall through to re-authentication
                }
            }
            onAuthExpired?.();
            return Promise.reject(new AuthExpiredError());
        }

        // Retry with exponential backoff on 429 (Too Many Requests).
        // Without this, a single rate-limit hit cascades: the STOMP WebSocket
        // reconnection loop fires more requests, compounding the 429 storm.
        if (error.response?.status === 429 && config && (config._retryCount ?? 0) < 3) {
            config._retryCount = (config._retryCount ?? 0) + 1;
            const retryAfter = error.response.headers['retry-after'];
            const delayMs = retryAfter
                ? parseInt(retryAfter, 10) * 1000
                : 1000 * Math.pow(2, config._retryCount); // 2s, 4s, 8s
            console.warn(`[API] 429 rate-limited, retrying in ${delayMs}ms (attempt ${config._retryCount}/3)`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return apiClient(config);
        }

        // Retry on network errors (CORS preflight failures, connection refused, DNS
        // resolution, cold-start timeouts).  These arrive with error.response === undefined
        // so the 429 check above never fires — without this, REST calls fail permanently
        // while the STOMP WebSocket (which has its own circuit-breaker) recovers fine.
        const isNetworkError = !error.response && error.code === 'ERR_NETWORK';
        if (isNetworkError && config && (config._networkRetryCount ?? 0) < 3) {
            config._networkRetryCount = (config._networkRetryCount ?? 0) + 1;
            const delayMs = 1000 * Math.pow(2, config._networkRetryCount); // 2s, 4s, 8s
            console.warn(
                `[API] Network error (${error.message}), retrying in ${delayMs}ms ` +
                `(attempt ${config._networkRetryCount}/3)`,
            );
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return apiClient(config);
        }

        return Promise.reject(error);
    }
);