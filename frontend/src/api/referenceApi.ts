import { apiClient } from './apiClient';

export interface DriverProfile {
    id: number;
    code: string;
    name: string;
    team: string;
    teamColor: string;
    stats: { speed: number; consistency: number; aggression: number; tireMgmt: number; experience: number; wins: number; podiums: number; };
}

export interface RaceSession {
    sessionKey: number; // Note the camelCase switch!
    sessionName: string;
    meetingName: string;
    year: number;
    countryName: string;
}

export const fetchDrivers = async (): Promise<DriverProfile[]> => {
    const res = await apiClient.get('/analysis/drivers');
    return res.data;
};

export const fetchSessions = async (): Promise<RaceSession[]> => {
    const res = await apiClient.get('/analysis/sessions');
    return res.data;
};