import { apiClient } from './apiClient';

export interface IngestionCommandRequest {
    mode: 'LIVE' | 'SIMULATION';
    sessionKey: number;
}

export const sendIngestionCommand = async (command: IngestionCommandRequest): Promise<string> => {
    try {
        const response = await apiClient.post('/ingestion/command', command);
        return response.data;
    } catch (error) {
        console.error("Failed to send ingestion command", error);
        throw error;
    }
};