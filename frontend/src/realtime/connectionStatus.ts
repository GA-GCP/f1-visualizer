/**
 * Single source of truth for real-time feed connectivity.
 *
 * The STOMP client publishes into this store from its own lifecycle callbacks;
 * the UI reads it with `useSyncExternalStore`.  This replaces the three 500 ms
 * pollers that previously each inferred connectivity from `stompClient.connected`
 * and disagreed with one another on first paint.
 */
export type ConnectionStatus =
    /** No connection has been attempted yet (logged out, or feed not needed). */
    | 'idle'
    /** First CONNECT in flight. */
    | 'connecting'
    /** CONNECTED frame received; subscriptions are live. */
    | 'connected'
    /** Socket dropped; the library's exponential backoff is retrying. */
    | 'reconnecting'
    /** A fresh token could not be acquired — reconnecting would fail identically. */
    | 'auth-rejected'
    /** Too many consecutive failures; the client was deactivated deliberately. */
    | 'circuit-open'
    /** The browser reports no network. */
    | 'offline';

/** Statuses from which an explicit user-triggered retry is the only way forward. */
export const TERMINAL_STATUSES: readonly ConnectionStatus[] = ['auth-rejected', 'circuit-open'];

let status: ConnectionStatus = 'idle';
const listeners = new Set<() => void>();

export function getConnectionStatus(): ConnectionStatus {
    return status;
}

export function setConnectionStatus(next: ConnectionStatus): void {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener();
}

export function subscribeConnectionStatus(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Test-only: restore the module to its initial state. */
export function resetConnectionStatus(): void {
    status = 'idle';
    listeners.clear();
}

// ── Browser connectivity ──
// The UI reported nothing about being offline; a dropped network looked
// identical to a broker problem.
if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => setConnectionStatus('offline'));
    window.addEventListener('online', () => {
        // The STOMP client's own reconnect will move this on to connected.
        if (status === 'offline') setConnectionStatus('reconnecting');
    });
}

/** Human-readable status, for chips and banners. */
export function describeConnectionStatus(value: ConnectionStatus): string {
    switch (value) {
        case 'idle': return 'Not connected';
        case 'connecting': return 'Connecting';
        case 'connected': return 'Live';
        case 'reconnecting': return 'Reconnecting';
        case 'auth-rejected': return 'Session expired';
        case 'circuit-open': return 'Feed unavailable';
        case 'offline': return 'Offline';
    }
}
