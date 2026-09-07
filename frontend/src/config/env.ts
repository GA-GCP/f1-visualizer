/**
 * The only module that reads `import.meta.env`.
 *
 * The API and WebSocket origins used to be decided independently in
 * apiClient.ts, stompClient.ts, the three .env files and the nginx CSP map —
 * five sources for one fact, so adding an environment meant edits in two
 * languages and a missed one failed only at runtime. They are all derived from
 * VITE_API_BASE_URL now, which every .env file already sets and nothing read.
 */

/** Local development: requests go through the Vite proxy (vite.config.ts). */
const LOCAL_API_BASE_URL = '/api/v1';

/**
 * The raw WebSocket path Spring exposes for the /ws endpoint.
 *
 * SockJS used to negotiate this via GET /ws/info; a native WebSocket connects
 * to it directly.
 */
const WS_PATH = '/ws/websocket';

/**
 * Takes the value, not the key.
 *
 * `import.meta.env[name]` is a dynamic index, which Vite cannot statically
 * replace — so it inlines the *whole* env object into the bundle instead of
 * just the values actually referenced. Every read here is a static property
 * access for that reason.
 */
function readRequired(name: string, value: string | undefined): { value: string; missing: string | null } {
    return typeof value === 'string' && value.length > 0
        ? { value, missing: null }
        : { value: '', missing: name };
}

/**
 * The broker lives at the API origin under /ws — the same relationship the two
 * hard-coded ladders encoded, derived rather than repeated.
 *
 * A ws:/wss: URL, because the client connects with a native WebSocket now
 * rather than through SockJS's http(s) handshake.
 */
function deriveWsUrl(apiBaseUrl: string): string {
    // Locally, go through the Vite proxy on whatever port it is serving, which
    // keeps the socket same-origin (vite.config.ts proxies /ws with ws: true).
    if (apiBaseUrl === LOCAL_API_BASE_URL) return localWsUrl();
    try {
        const { host, protocol } = new URL(apiBaseUrl);
        return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${WS_PATH}`;
    } catch {
        return localWsUrl();
    }
}

function localWsUrl(): string {
    if (typeof window === 'undefined') return `ws://localhost:5173${WS_PATH}`;
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${window.location.host}${WS_PATH}`;
}

const domain = readRequired('VITE_AUTH0_DOMAIN', import.meta.env.VITE_AUTH0_DOMAIN);
const clientId = readRequired('VITE_AUTH0_CLIENT_ID', import.meta.env.VITE_AUTH0_CLIENT_ID);
const audience = readRequired('VITE_AUTH0_AUDIENCE', import.meta.env.VITE_AUTH0_AUDIENCE);

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || LOCAL_API_BASE_URL;

export const env = {
    auth0: {
        domain: domain.value,
        clientId: clientId.value,
        audience: audience.value,
    },
    apiBaseUrl,
    wsUrl: deriveWsUrl(apiBaseUrl),
    stompDebug: import.meta.env.VITE_STOMP_DEBUG === 'true',
} as const;

/**
 * Names of required variables that are absent or empty.
 *
 * Reported rather than thrown at import: a module-load throw would take down
 * every test that transitively imports this, and a misconfigured build deserves
 * a readable message at boot rather than a stack trace on first import.
 */
export const missingEnvVars: readonly string[] = [domain, clientId, audience]
    .map(entry => entry.missing)
    .filter((name): name is string => name !== null);
