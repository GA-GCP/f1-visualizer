import type { LapDataRecord } from '../../types/telemetry';

export interface CurrentLap {
    lapNumber: number;
    totalLaps: number;
    isPitOutLap: boolean;
    compound: string | null;
    prevCompound: string | null;
    isFormationLap: boolean;
}

interface DriverLapIndex {
    /** Lap start times in epoch ms, ascending. Parallel to `laps`. */
    startsMs: number[];
    /** Laps ordered by start time. */
    laps: LapDataRecord[];
    totalLaps: number;
}

export type LapIndex = ReadonlyMap<number, DriverLapIndex>;

/**
 * Builds a per-driver, start-time-ordered index of a session's laps.
 *
 * Call this once when the laps arrive. The correlation used to run inside the
 * telemetry callback instead: for every packet it filtered all laps, sorted them
 * with a comparator that constructed two Date objects per comparison, then
 * linearly scanned with more Date parses. That is thousands of Date allocations
 * a second on the hot path, all recomputing a result that never changes.
 */
export function buildLapIndex(sessionLaps: readonly LapDataRecord[]): LapIndex {
    const byDriver = new Map<number, LapDataRecord[]>();

    for (const lap of sessionLaps) {
        if (!lap.dateStart) continue;
        const existing = byDriver.get(lap.driverNumber);
        if (existing) existing.push(lap);
        else byDriver.set(lap.driverNumber, [lap]);
    }

    const index = new Map<number, DriverLapIndex>();
    for (const [driverNumber, laps] of byDriver) {
        laps.sort((a, b) => Date.parse(a.dateStart!) - Date.parse(b.dateStart!));
        index.set(driverNumber, {
            startsMs: laps.map((lap) => Date.parse(lap.dateStart!)),
            laps,
            totalLaps: laps.reduce((max, lap) => Math.max(max, lap.lapNumber), 0),
        });
    }
    return index;
}

/**
 * Index of the last entry in `ascending` that is <= `value`, or -1 if none is.
 */
function lastAtOrBefore(ascending: readonly number[], value: number): number {
    let low = 0;
    let high = ascending.length - 1;
    let found = -1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        if (ascending[mid] <= value) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return found;
}

/** The lap a driver was on at `atMs`, or null if that is before their first lap. */
export function findCurrentLap(
    index: LapIndex,
    driverNumber: number,
    atMs: number,
): CurrentLap | null {
    const driver = index.get(driverNumber);
    if (!driver || driver.laps.length === 0) return null;

    const position = lastAtOrBefore(driver.startsMs, atMs);
    if (position < 0) return null;

    const lap = driver.laps[position];
    // Only treat the preceding entry as "the previous lap" when it really is
    // lap n-1. The original matched on lap number, so a gap in the data must
    // yield no previous compound rather than an unrelated earlier lap.
    const preceding = position > 0 ? driver.laps[position - 1] : undefined;
    const previous = preceding?.lapNumber === lap.lapNumber - 1 ? preceding : undefined;

    return {
        lapNumber: lap.lapNumber,
        totalLaps: driver.totalLaps,
        isPitOutLap: lap.isPitOutLap ?? false,
        compound: lap.compound ?? null,
        prevCompound: previous?.compound ?? null,
        isFormationLap: lap.lapNumber === 0,
    };
}
