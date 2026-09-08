import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'; // <-- 'act' imported here
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playSimulation, pauseSimulation, seekSimulation } from '@/api/ingestionApi';
import MediaController from '../MediaController';

// Mock the API calls (mockResolvedValue ensures the await inside the component finishes)
vi.mock('../../api/ingestionApi', () => ({
    playSimulation: vi.fn().mockResolvedValue(undefined),
    pauseSimulation: vi.fn().mockResolvedValue(undefined),
    seekSimulation: vi.fn().mockResolvedValue(undefined),
}));

describe('MediaController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders successfully and defaults to playing state', () => {
        render(<MediaController />);

        expect(screen.getByText('SIMULATION TIMELINE')).toBeInTheDocument();

        // The accessible name is the contract. The MUI icon's data-testid is an
        // implementation detail MUI does not guarantee, and the assertion below
        // already covers what a user can perceive.
        expect(screen.getByRole('button', { name: /pause simulation/i })).toBeInTheDocument();
    });

    it('toggles play/pause and calls the respective API endpoints', async () => {
        render(<MediaController />);
        const toggleBtn = screen.getByRole('button', { name: /pause simulation/i });

        // 1. Wrap the async interaction in act()
        await act(async () => {
            fireEvent.click(toggleBtn);
        });

        expect(pauseSimulation).toHaveBeenCalledTimes(1);
        expect(playSimulation).not.toHaveBeenCalled();

        // 2. WAIT for React to process the async state update!
        // The Pause icon should switch to the Play icon.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /play simulation/i })).toBeInTheDocument();
        });

        // 3. Wrap the second async interaction in act()
        await act(async () => {
            fireEvent.click(toggleBtn);
        });

        expect(playSimulation).toHaveBeenCalledTimes(1);
        expect(pauseSimulation).toHaveBeenCalledTimes(1);
    });

    it('calls onSeek before seekSimulation to clear stale trace data', async () => {
        const callOrder: string[] = [];
        const onSeek = vi.fn(() => {
            callOrder.push('onSeek');
        });
        vi.mocked(seekSimulation).mockImplementation(async () => {
            callOrder.push('seekSimulation');
        });

        render(<MediaController onSeek={onSeek} />);

        const slider = screen.getByRole('slider');

        // Simulate a committed seek (mouseup after dragging the slider)
        await act(async () => {
            fireEvent.change(slider, { target: { value: 30 } });
            fireEvent.mouseUp(slider);
        });

        // Wait for async handlers to finish
        await waitFor(() => {
            expect(seekSimulation).toHaveBeenCalled();
        });

        expect(onSeek).toHaveBeenCalled();
        expect(callOrder.indexOf('onSeek')).toBeLessThan(callOrder.indexOf('seekSimulation'));
    });
});
