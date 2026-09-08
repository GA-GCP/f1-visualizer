import { useSyncExternalStore } from 'react';
import {
    getConnectionStatus,
    subscribeConnectionStatus,
    type ConnectionStatus,
} from './connectionStatus';

/**
 * The live feed's connection state.
 *
 * Replaces three independent 500 ms pollers that each inferred connectivity
 * from `stompClient.connected`. They disagreed on first paint — both feed chips
 * showed a red OFF for the first seconds of every dashboard load, before any
 * connection attempt had had a chance to fail — and none of them could
 * distinguish "connecting" from "the breaker is open".
 */
export function useConnectionStatus(): ConnectionStatus {
    return useSyncExternalStore(
        subscribeConnectionStatus,
        getConnectionStatus,
        getConnectionStatus,
    );
}
