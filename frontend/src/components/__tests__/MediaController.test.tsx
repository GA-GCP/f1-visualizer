import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MediaController from '../MediaController';
import { playSimulation, pauseSimulation } from '../../api/ingestionApi';

// Mock the API calls (mockResolvedValue ensures the await inside the component finishes)
vi.mock('../../api/ingestionApi', () => ({
    playSimulation: vi.fn().mockResolvedValue(undefined),
    pauseSimulation: vi.fn().mockResolvedValue(undefined),
    seekSimulation: vi.fn().mockResolvedValue(undefined)
}));

describe('MediaController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders successfully and defaults to playing state', () => {
        render(<MediaController />);

        expect(screen.getByText('SIMULATION TIMELINE')).toBeInTheDocument();

        // Since isPlaying defaults to true, the Pause icon (used to trigger a pause) should be in the DOM
        expect(screen.getByTestId('PauseIcon')).toBeInTheDocument();
    });

    it('toggles play/pause and calls the respective API endpoints', async () => {
        render(<MediaController />);
        const toggleBtn = screen.getByRole('button');

        // 1. Initially playing, so clicking it should pause the simulation
        fireEvent.click(toggleBtn);
        expect(pauseSimulation).toHaveBeenCalledTimes(1);
        expect(playSimulation).not.toHaveBeenCalled();

        // 2. WAIT for React to process the async state update!
        // The Pause icon should switch to the Play icon.
        await waitFor(() => {
            expect(screen.getByTestId('PlayArrowIcon')).toBeInTheDocument();
        });

        // 3. Now the state is paused. Clicking again should play the simulation.
        fireEvent.click(toggleBtn);
        expect(playSimulation).toHaveBeenCalledTimes(1);

        // pauseSimulation remains at 1 call from the previous click
        expect(pauseSimulation).toHaveBeenCalledTimes(1);
    });
});