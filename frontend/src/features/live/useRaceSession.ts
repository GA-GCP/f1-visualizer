import { useCallback, useReducer } from 'react';
import type { RaceSession } from '../../api/referenceApi';

export type RaceSessionMode = 'LIVE' | 'SIMULATION';

interface SessionMeta {
    year: number;
    meetingName: string;
}

/**
 * The live console's session lifecycle as one state machine.
 *
 * These were four independent pieces of state — `activeSession`,
 * `sessionMeta`, `isInitializing`, `traceResetKey` — plus a ref mirroring one
 * of them, all updated together by hand in three separate handlers. Nothing
 * stopped them disagreeing: a cancel that forgot to clear `isInitializing`
 * would leave the "INITIALIZING" overlay up over an idle canvas.
 */
export type RaceSessionState =
    | { status: 'idle'; resetKey: number }
    | { status: 'initializing'; resetKey: number; key: number; mode: RaceSessionMode; meta: SessionMeta }
    | { status: 'active'; resetKey: number; key: number; mode: RaceSessionMode; meta: SessionMeta };

type Action =
    | { type: 'start'; key: number; mode: RaceSessionMode; session: RaceSession }
    | { type: 'firstFrame' }
    | { type: 'seek' }
    | { type: 'cancel' };

function reducer(state: RaceSessionState, action: Action): RaceSessionState {
    switch (action.type) {
        case 'start':
            return {
                status: 'initializing',
                // Bumped on every transition that invalidates what is on screen,
                // so the trace and the telemetry panel clear together.
                resetKey: state.resetKey + 1,
                key: action.key,
                mode: action.mode,
                meta: { year: action.session.year, meetingName: action.session.meetingName },
            };

        case 'firstFrame':
            // Only meaningful while initializing; a late packet cannot revive a
            // cancelled session.
            return state.status === 'initializing' ? { ...state, status: 'active' } : state;

        case 'seek':
            // A seek keeps the session but invalidates every buffered position.
            return state.status === 'idle' ? state : { ...state, resetKey: state.resetKey + 1 };

        case 'cancel':
            return { status: 'idle', resetKey: state.resetKey + 1 };
    }
}

export interface RaceSessionApi {
    state: RaceSessionState;
    /** Null unless a session is running. */
    activeSession: { key: number; mode: RaceSessionMode } | null;
    meta: SessionMeta | null;
    isSessionActive: boolean;
    isInitializing: boolean;
    resetKey: number;
    start: (key: number, mode: RaceSessionMode, session: RaceSession) => void;
    firstFrame: () => void;
    seek: () => void;
    cancel: () => void;
}

export function useRaceSession(): RaceSessionApi {
    const [state, dispatch] = useReducer(reducer, { status: 'idle', resetKey: 0 });

    const start = useCallback(
        (key: number, mode: RaceSessionMode, session: RaceSession) =>
            dispatch({ type: 'start', key, mode, session }),
        [],
    );
    const firstFrame = useCallback(() => dispatch({ type: 'firstFrame' }), []);
    const seek = useCallback(() => dispatch({ type: 'seek' }), []);
    const cancel = useCallback(() => dispatch({ type: 'cancel' }), []);

    return {
        state,
        activeSession: state.status === 'idle' ? null : { key: state.key, mode: state.mode },
        meta: state.status === 'idle' ? null : state.meta,
        isSessionActive: state.status !== 'idle',
        isInitializing: state.status === 'initializing',
        resetKey: state.resetKey,
        start,
        firstFrame,
        seek,
        cancel,
    };
}
