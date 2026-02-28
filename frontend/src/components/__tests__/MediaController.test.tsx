import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'; // <-- 'act' imported here
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MediaController from '../MediaController';
import { playSimulation, pauseSimulation } from '@/api/ingestionApi.ts';

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

        // 1. Wrap the async interaction in act()
        await act(async () => {
            fireEvent.click(toggleBtn);
        });

        expect(pauseSimulation).toHaveBeenCalledTimes(1);
        expect(playSimulation).not.toHaveBeenCalled();

        // 2. WAIT for React to process the async state update!
        // The Pause icon should switch to the Play icon.
        await waitFor(() => {
            expect(screen.getByTestId('PlayArrowIcon')).toBeInTheDocument();
        });

        // 3. Wrap the second async interaction in act()
        await act(async () => {
            fireEvent.click(toggleBtn);
        });

        expect(playSimulation).toHaveBeenCalledTimes(1);
        expect(pauseSimulation).toHaveBeenCalledTimes(1);
    });
});