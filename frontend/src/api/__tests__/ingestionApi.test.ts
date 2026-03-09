import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the module under test
vi.mock('../apiClient', () => ({
    apiClient: {
        post: vi.fn(),
    },
}));

import { apiClient } from '../apiClient';
import {
    sendIngestionCommand,
    playSimulation,
    pauseSimulation,
    seekSimulation,
} from '../ingestionApi';
import type { IngestionCommandRequest } from '../ingestionApi';

describe('ingestionApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendIngestionCommand', () => {
        it('posts the command payload and returns server response', async () => {
            const command: IngestionCommandRequest = { mode: 'SIMULATION', sessionKey: 9165 };
            vi.mocked(apiClient.post).mockResolvedValue({ data: 'STARTED' });

            const result = await sendIngestionCommand(command);

            expect(apiClient.post).toHaveBeenCalledWith('/ingestion/command', command);
            expect(result).toBe('STARTED');
        });

        it('logs and re-throws on failure', async () => {
            const error = new Error('Network Error');
            vi.mocked(apiClient.post).mockRejectedValue(error);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(sendIngestionCommand({ mode: 'LIVE', sessionKey: 1 })).rejects.toThrow('Network Error');
            expect(consoleSpy).toHaveBeenCalledWith('Failed to send ingestion command', error);

            consoleSpy.mockRestore();
        });
    });

    describe('playSimulation', () => {
        it('posts to the play endpoint', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({ data: undefined });

            await playSimulation();

            expect(apiClient.post).toHaveBeenCalledWith('/ingestion/playback/play');
        });
    });

    describe('pauseSimulation', () => {
        it('posts to the pause endpoint', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({ data: undefined });

            await pauseSimulation();

            expect(apiClient.post).toHaveBeenCalledWith('/ingestion/playback/pause');
        });
    });

    describe('seekSimulation', () => {
        it('posts to the seek endpoint with percentage query param', async () => {
            vi.mocked(apiClient.post).mockResolvedValue({ data: undefined });

            await seekSimulation(42.5);

            expect(apiClient.post).toHaveBeenCalledWith('/ingestion/playback/seek?percentage=42.5');
        });
    });
});
