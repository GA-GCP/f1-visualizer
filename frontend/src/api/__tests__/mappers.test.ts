import { describe, it, expect } from 'vitest';
import { rosterToDriverProfiles } from '../mappers';
import type { RaceEntryRoster } from '../schemas';

const roster = (over: Partial<RaceEntryRoster['drivers'][number]> = {}): RaceEntryRoster => ({
    sessionKey: 9165,
    year: 2023,
    drivers: [
        {
            driverNumber: 44,
            broadcastName: 'L HAMILTON',
            nameAcronym: 'HAM',
            teamName: 'Mercedes',
            teamColour: '00D2BE',
            countryCode: 'GBR',
            ...over,
        },
    ],
});

describe('rosterToDriverProfiles', () => {
    it('prefers the official acronym for the code', () => {
        expect(rosterToDriverProfiles(roster())[0].code).toBe('HAM');
    });

    it('falls back to the broadcast name when there is no acronym', () => {
        expect(rosterToDriverProfiles(roster({ nameAcronym: '' }))[0].code).toBe('L H');
    });

    it('falls back to the number when neither is usable', () => {
        expect(
            rosterToDriverProfiles(roster({ nameAcronym: '', broadcastName: 'X' }))[0].code,
        ).toBe('44');
    });

    it("adds the '#' the wire format omits", () => {
        expect(rosterToDriverProfiles(roster())[0].teamColor).toBe('#00D2BE');
    });

    it('defaults a missing team colour to white rather than an invalid value', () => {
        expect(rosterToDriverProfiles(roster({ teamColour: '' }))[0].teamColor).toBe('#ffffff');
    });

    it('names an unknown team rather than leaving it blank', () => {
        expect(rosterToDriverProfiles(roster({ teamName: '' }))[0].team).toBe('Unknown');
    });
});
