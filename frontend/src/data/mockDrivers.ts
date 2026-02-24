export interface DriverProfile {
    id: number;
    code: string; // e.g. "VER"
    name: string;
    team: string;
    teamColor: string;
    stats: {
        speed: number;
        consistency: number;
        aggression: number;
        tireMgmt: number;
        experience: number;
        wins: number;
        podiums: number;
    };
}

export const MOCK_DRIVERS: DriverProfile[] = [
    {
        id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull Racing", teamColor: "#3671C6",
        stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98 }
    },
    {
        id: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", teamColor: "#E80020",
        stats: { speed: 96, consistency: 88, aggression: 90, tireMgmt: 85, experience: 80, wins: 5, podiums: 30 }
    },
    {
        id: 44, code: "HAM", name: "Lewis Hamilton", team: "Mercedes", teamColor: "#27F4D2",
        stats: { speed: 94, consistency: 98, aggression: 85, tireMgmt: 99, experience: 99, wins: 103, podiums: 197 }
    },
    {
        id: 14, code: "ALO", name: "Fernando Alonso", team: "Aston Martin", teamColor: "#229971",
        stats: { speed: 88, consistency: 92, aggression: 95, tireMgmt: 96, experience: 100, wins: 32, podiums: 106 }
    },
    {
        id: 4, code: "NOR", name: "Lando Norris", team: "McLaren", teamColor: "#FF8000",
        stats: { speed: 92, consistency: 90, aggression: 92, tireMgmt: 88, experience: 75, wins: 1, podiums: 14 }
    }
];