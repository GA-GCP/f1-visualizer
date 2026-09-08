import { createLogger } from '../lib/logger';
import { apiClient } from './apiClient';

const log = createLogger('ingestion');

// These are POSTs and are deliberately excluded from the retry policy in
// apiClient: replaying a playback command or an ingestion start is a real
// side effect, and the old network-error branch could do it three times.
//
// To make them retryable, the backend must first accept an Idempotency-Key
// header; the client would then send a UUID per user action and pass
// `{ idempotent: true }` on the request config. Until then, not retrying is
// the correct behaviour.

export interface IngestionCommandRequest {
    mode: 'LIVE' | 'SIMULATION';
    sessionKey: number;
}

export const sendIngestionCommand = async (command: IngestionCommandRequest): Promise<string> => {
    try {
        // The generic, rather than returning axios's `any` and letting the
        // declared Promise<string> assert it silently. Still an assertion
        // about the wire — but a visible one, unlike the `any` it replaces.
        const response = await apiClient.post<string>('/ingestion/command', command);
        return response.data;
    } catch (error) {
        log.error("Failed to send ingestion command", error);
        throw error;
    }
};

export const playSimulation = async (): Promise<void> => {
    await apiClient.post('/ingestion/playback/play');
};

export const pauseSimulation = async (): Promise<void> => {
    await apiClient.post('/ingestion/playback/pause');
};

export const seekSimulation = async (percentage: number): Promise<void> => {
    await apiClient.post(`/ingestion/playback/seek?percentage=${percentage}`);
};