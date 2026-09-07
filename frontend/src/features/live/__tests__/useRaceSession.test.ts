import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRaceSession } from '../useRaceSession';
import type { RaceSession } from '../../../api/referenceApi';

const race: RaceSession = {
    sessionKey: 9165,
    sessionName: 'Race',
    meetingName: 'Singapore Grand Prix',
    year: 2023,
    countryName: 'Singapore',
};

describe('useRaceSession', () => {
    it('starts idle with nothing selected', () => {
        const { result } = renderHook(() => useRaceSession());

        expect(result.current.isSessionActive).toBe(false);
        expect(result.current.isInitializing).toBe(false);
        expect(result.current.activeSession).toBeNull();
        expect(result.current.meta).toBeNull();
    });

    it('enters initializing on start, carrying the session identity', () => {
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'SIMULATION', race));

        expect(result.current.isSessionActive).toBe(true);
        expect(result.current.isInitializing).toBe(true);
        expect(result.current.activeSession).toEqual({ key: 9165, mode: 'SIMULATION' });
        expect(result.current.meta).toEqual({ year: 2023, meetingName: 'Singapore Grand Prix' });
    });

    it('becomes active on the first frame', () => {
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'LIVE', race));
        act(() => result.current.firstFrame());

        expect(result.current.isInitializing).toBe(false);
        expect(result.current.isSessionActive).toBe(true);
    });

    it('ignores a late first frame after cancelling', () => {
        // A packet still in flight must not revive a session the user stopped.
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'LIVE', race));
        act(() => result.current.cancel());
        act(() => result.current.firstFrame());

        expect(result.current.isSessionActive).toBe(false);
    });

    it('bumps the reset key on every transition that invalidates the screen', () => {
        const { result } = renderHook(() => useRaceSession());
        const initial = result.current.resetKey;

        act(() => result.current.start(9165, 'SIMULATION', race));
        const afterStart = result.current.resetKey;
        act(() => result.current.seek());
        const afterSeek = result.current.resetKey;
        act(() => result.current.cancel());

        expect(afterStart).toBeGreaterThan(initial);
        expect(afterSeek).toBeGreaterThan(afterStart);
        expect(result.current.resetKey).toBeGreaterThan(afterSeek);
    });

    it('does not bump the reset key on a frame arriving', () => {
        // Clearing the trace when data starts flowing would erase the lap just drawn.
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'LIVE', race));
        const afterStart = result.current.resetKey;
        act(() => result.current.firstFrame());

        expect(result.current.resetKey).toBe(afterStart);
    });

    it('keeps the session through a seek', () => {
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'SIMULATION', race));
        act(() => result.current.firstFrame());
        act(() => result.current.seek());

        expect(result.current.activeSession).toEqual({ key: 9165, mode: 'SIMULATION' });
        expect(result.current.isSessionActive).toBe(true);
    });

    it('seeking while idle changes nothing', () => {
        const { result } = renderHook(() => useRaceSession());
        const initial = result.current.resetKey;

        act(() => result.current.seek());

        expect(result.current.resetKey).toBe(initial);
        expect(result.current.isSessionActive).toBe(false);
    });

    it('clears everything on cancel', () => {
        // Four separate pieces of state updated by hand could disagree — a
        // cancel that forgot isInitializing left the overlay up over idle canvas.
        const { result } = renderHook(() => useRaceSession());

        act(() => result.current.start(9165, 'LIVE', race));
        act(() => result.current.cancel());

        expect(result.current.activeSession).toBeNull();
        expect(result.current.meta).toBeNull();
        expect(result.current.isInitializing).toBe(false);
        expect(result.current.isSessionActive).toBe(false);
    });
});
