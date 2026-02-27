export interface RaceSession {
    session_key: number;
    session_name: string;
    meeting_name: string;
    year: number;
    country_name: string;
}

export const MOCK_SESSIONS: RaceSession[] = [
    { session_key: 9165, session_name: "Race", meeting_name: "Singapore Grand Prix", year: 2023, country_name: "Singapore" },
    { session_key: 9158, session_name: "Race", meeting_name: "Italian Grand Prix", year: 2023, country_name: "Italy" },
    { session_key: 9161, session_name: "Race", meeting_name: "Dutch Grand Prix", year: 2023, country_name: "Netherlands" },
    { session_key: 9153, session_name: "Race", meeting_name: "British Grand Prix", year: 2023, country_name: "Great Britain" },
    { session_key: 9159, session_name: "Race", meeting_name: "Miami Grand Prix", year: 2023, country_name: "USA" }
];