import axios from 'axios';

// 1. Dynamically determine the base URL based on the Vite build mode
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

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        if (error.response?.status === 401) {
            console.warn('[API] Unauthorized. User session may have expired.');
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