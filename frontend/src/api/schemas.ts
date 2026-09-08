import * as z from 'zod/mini';

/**
 * Runtime contracts for the wire format.
 *
 * `res.data` is `any` from axios, so every `as DriverProfile[]` asserted a shape
 * the compiler never checked: a backend rename would pass `tsc -b`, pass every
 * test (they mock the API), and fail only in production — as NaN coordinates on
 * the canvas or an empty radar, with no signal to the user.
 *
 * The schema is the single source of truth; the TypeScript types are inferred
 * from it, so the two cannot drift.
 */

// ── Real-time (STOMP) ──

export const telemetryPacketSchema = z.object({
    session_key: z.number(),
    meeting_key: z.number(),
    date: z.string(),
    driver_number: z.number(), // snake_case: matches the JSON wire format
    speed: z.number(),
    rpm: z.number(),
    gear: z.number(),
    throttle: z.number(),
    brake: z.number(),
    drs: z.number(),
});
export type TelemetryPacket = z.infer<typeof telemetryPacketSchema>;

export const locationPacketSchema = z.object({
    session_key: z.number(),
    meeting_key: z.number(),
    date: z.string(),
    driver_number: z.number(),
    x: z.number(),
    y: z.number(),
    z: z.number(),
});
export type LocationPacket = z.infer<typeof locationPacketSchema>;

// ── Analysis service ──

export const driverStatsSchema = z.object({
    speed: z.number(),
    consistency: z.number(),
    aggression: z.number(),
    tireMgmt: z.number(),
    experience: z.number(),
    wins: z.number(),
    podiums: z.number(),
    totalPoints: z.number(),
    bestChampionshipFinish: z.number(),
    totalRaces: z.number(),
    teamsDrivenFor: z.array(z.string()),
});

export const driverProfileSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    team: z.string(),
    teamColor: z.string(),
    stats: driverStatsSchema,
});
export type DriverProfile = z.infer<typeof driverProfileSchema>;

export const raceSessionSchema = z.object({
    sessionKey: z.number(), // camelCase here, unlike the STOMP payloads
    sessionName: z.string(),
    meetingName: z.string(),
    year: z.number(),
    countryName: z.string(),
});
export type RaceSession = z.infer<typeof raceSessionSchema>;

export const sessionDriverEntrySchema = z.object({
    driverNumber: z.number(),
    broadcastName: z.string(),
    nameAcronym: z.string(),
    teamName: z.string(),
    teamColour: z.string(), // hex without the '#' prefix
    countryCode: z.string(),
});

export type SessionDriverEntry = z.infer<typeof sessionDriverEntrySchema>;

export const raceEntryRosterSchema = z.object({
    sessionKey: z.number(),
    year: z.number(),
    drivers: z.array(sessionDriverEntrySchema),
});
export type RaceEntryRoster = z.infer<typeof raceEntryRosterSchema>;

export const lapDataRecordSchema = z.object({
    driverNumber: z.number(),
    lapNumber: z.number(),
    lapDuration: z.optional(z.number()),
    sector1: z.optional(z.number()),
    sector2: z.optional(z.number()),
    sector3: z.optional(z.number()),
    compound: z.optional(z.string()),
    dateStart: z.optional(z.string()), // ISO-8601
    isPitOutLap: z.optional(z.boolean()),
});
export type LapDataRecord = z.infer<typeof lapDataRecordSchema>;

// ── User service ──

export const userPreferencesSchema = z.object({
    favoriteDriver: z.optional(z.string()),
    team: z.optional(z.string()),
    defaultTelemetryView: z.optional(z.string()),
    savedQueries: z.optional(z.array(z.string())),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const userProfileSchema = z.object({
    authSubId: z.string(),
    email: z.string(),
    createdAt: z.union([z.object({ seconds: z.number(), nanos: z.number() }), z.string()]),
    preferences: userPreferencesSchema,
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/** A lap whose duration and start time are known. */
export type TimedLap = LapDataRecord & { lapDuration: number; dateStart: string };

/**
 * Narrows a lap to one that can be plotted or correlated.
 *
 * Consumers used to filter on these fields and then re-assert with `!` at every
 * subsequent use — five times in LapTimeChart alone. The assertion says "trust
 * me" to the compiler at each site, so the day the filter changes, nothing
 * fails; the reads just start producing undefined. Narrowing once means the
 * type carries the guarantee instead.
 */
export function isTimedLap(lap: LapDataRecord): lap is TimedLap {
    return (
        typeof lap.lapDuration === 'number' &&
        lap.lapDuration > 0 &&
        typeof lap.dateStart === 'string'
    );
}

/** A lap whose start time is known, so it can be ordered and correlated. */
export type StartedLap = LapDataRecord & { dateStart: string };

/** Narrows a lap to one that has a start time. */
export function hasLapStart(lap: LapDataRecord): lap is StartedLap {
    return typeof lap.dateStart === 'string' && lap.dateStart.length > 0;
}

/** A lap that can be plotted: its duration is known, its start time need not be. */
export type PlottableLap = LapDataRecord & { lapDuration: number };

/** Narrows a lap to one with a usable duration, ignoring its start time. */
export function hasLapDuration(lap: LapDataRecord): lap is PlottableLap {
    return typeof lap.lapDuration === 'number' && lap.lapDuration > 0;
}
