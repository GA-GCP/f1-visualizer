import { describe, it, expect } from 'vitest';
import { buildLapIndex, findCurrentLap } from '../lapCorrelation';
import type { LapDataRecord } from '../../../types/telemetry';

const at = (iso: string) => Date.parse(iso);

const lap = (
    over: Partial<LapDataRecord> & { lapNumber: number; dateStart: string },
): LapDataRecord => ({
    driverNumber: 1,
    ...over,
});

describe('buildLapIndex / findCurrentLap', () => {
    const laps: LapDataRecord[] = [
        // Deliberately out of order: the source data is not sorted.
        lap({ lapNumber: 2, dateStart: '2024-05-01T12:01:30Z', compound: 'MEDIUM' }),
        lap({ lapNumber: 0, dateStart: '2024-05-01T12:00:00Z', compound: 'SOFT' }),
        lap({ lapNumber: 1, dateStart: '2024-05-01T12:01:00Z', compound: 'SOFT' }),
        lap({
            lapNumber: 3,
            dateStart: '2024-05-01T12:02:00Z',
            compound: 'MEDIUM',
            isPitOutLap: true,
        }),
        lap({
            driverNumber: 44,
            lapNumber: 1,
            dateStart: '2024-05-01T12:00:30Z',
            compound: 'HARD',
        }),
    ];
    const index = buildLapIndex(laps);

    it('finds the lap in progress at a timestamp', () => {
        const current = findCurrentLap(index, 1, at('2024-05-01T12:01:45Z'));
        expect(current).toMatchObject({ lapNumber: 2, compound: 'MEDIUM' });
    });

    it('treats a timestamp exactly on a lap start as that lap', () => {
        expect(findCurrentLap(index, 1, at('2024-05-01T12:01:00Z'))?.lapNumber).toBe(1);
    });

    it('returns null before the driver has started a lap', () => {
        expect(findCurrentLap(index, 1, at('2024-05-01T11:59:59Z'))).toBeNull();
    });

    it('stays on the final lap after its start', () => {
        expect(findCurrentLap(index, 1, at('2024-05-01T23:00:00Z'))?.lapNumber).toBe(3);
    });

    it('keeps drivers independent', () => {
        const current = findCurrentLap(index, 44, at('2024-05-01T12:05:00Z'));
        expect(current).toMatchObject({ lapNumber: 1, compound: 'HARD', totalLaps: 1 });
    });

    it('returns null for a driver with no laps', () => {
        expect(findCurrentLap(index, 99, at('2024-05-01T12:01:45Z'))).toBeNull();
    });

    it('reports totalLaps as the highest lap number for that driver', () => {
        expect(findCurrentLap(index, 1, at('2024-05-01T12:02:30Z'))?.totalLaps).toBe(3);
    });

    it('flags lap 0 as the formation lap', () => {
        const current = findCurrentLap(index, 1, at('2024-05-01T12:00:10Z'));
        expect(current).toMatchObject({ lapNumber: 0, isFormationLap: true });
    });

    it('carries the pit-out flag', () => {
        expect(findCurrentLap(index, 1, at('2024-05-01T12:02:10Z'))?.isPitOutLap).toBe(true);
    });

    it('exposes the previous lap compound so a change can be shown', () => {
        // Lap 2 is MEDIUM, lap 1 was SOFT.
        expect(findCurrentLap(index, 1, at('2024-05-01T12:01:45Z'))?.prevCompound).toBe('SOFT');
    });

    it('reports no previous compound when lap n-1 is missing from the data', () => {
        const gapped = buildLapIndex([
            lap({ lapNumber: 1, dateStart: '2024-05-01T12:00:00Z', compound: 'SOFT' }),
            lap({ lapNumber: 5, dateStart: '2024-05-01T12:05:00Z', compound: 'HARD' }),
        ]);
        expect(findCurrentLap(gapped, 1, at('2024-05-01T12:06:00Z'))?.prevCompound).toBeNull();
    });

    it('ignores laps with no start time', () => {
        const index = buildLapIndex([
            lap({ lapNumber: 1, dateStart: '2024-05-01T12:00:00Z' }),
            { driverNumber: 1, lapNumber: 2 },
        ]);
        expect(findCurrentLap(index, 1, at('2024-05-01T13:00:00Z'))?.lapNumber).toBe(1);
    });

    it('handles an empty session', () => {
        expect(findCurrentLap(buildLapIndex([]), 1, Date.now())).toBeNull();
    });
});
