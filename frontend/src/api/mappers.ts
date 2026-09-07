import type { DriverProfile, RaceEntryRoster, SessionDriverEntry } from './schemas';

/** Placeholder attributes for drivers that come from a session roster.
 *
 *  The roster carries identity and livery, not performance attributes; the
 *  radar's five axes are only populated by /analysis/drivers/:id/stats. These
 *  neutral values keep the type satisfied without implying real measurements.
 */
const UNRATED_STATS: DriverProfile['stats'] = {
    speed: 80, consistency: 80, aggression: 80, tireMgmt: 80, experience: 80,
    wins: 0, podiums: 0, totalPoints: 0, bestChampionshipFinish: 0, totalRaces: 0,
    teamsDrivenFor: [],
};

/** Three letters for a driver, preferring the official acronym. */
function driverCode(entry: SessionDriverEntry): string {
    if (entry.nameAcronym) return entry.nameAcronym;
    if (entry.broadcastName?.length >= 3) return entry.broadcastName.slice(0, 3).toUpperCase();
    return String(entry.driverNumber);
}

/**
 * Converts a session roster into the profile shape the selectors and charts use.
 *
 * Lived inline in RaceSimulator, where a DTO mapping sat between the session
 * lifecycle and the layout.
 */
export function rosterToDriverProfiles(roster: RaceEntryRoster): DriverProfile[] {
    return roster.drivers.map(entry => ({
        id: entry.driverNumber,
        code: driverCode(entry),
        name: entry.broadcastName || 'Unknown',
        team: entry.teamName || 'Unknown',
        // The wire format omits the '#'.
        teamColor: `#${entry.teamColour || 'ffffff'}`,
        stats: UNRATED_STATS,
    }));
}
