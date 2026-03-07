export interface TelemetryPacket {
    session_key: number;
    meeting_key: number;
    date: string;
    driver_number: number; // Matches JSON wire format
    speed: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    drs: number;
}

export interface LocationPacket {
    session_key: number;
    meeting_key: number;
    date: string;
    driver_number: number; // Matches JSON wire format
    x: number;
    y: number;
    z: number;
}

export interface LapDataRecord {
    driverNumber: number;
    lapNumber: number;
    lapDuration?: number;
    sector1?: number;
    sector2?: number;
    sector3?: number;
    compound?: string;
    dateStart?: string;     // ISO-8601 timestamp
    isPitOutLap?: boolean;
}
