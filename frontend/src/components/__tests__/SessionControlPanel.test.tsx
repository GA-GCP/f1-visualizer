import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionControlPanel from '../selectors/SessionControlPanel';
import { sendIngestionCommand } from '../../api/ingestionApi';

// 1. Mock the API module
vi.mock('../../api/ingestionApi', () => ({
    sendIngestionCommand: vi.fn()
}));

describe('SessionControlPanel', () => {
    const mockOnStreamStarted = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the control panel with default SIMULATION mode', () => {
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        expect(screen.getByText('RACE INITIALIZATION')).toBeInTheDocument();
        // UPDATED: Check for the new Autocomplete label and default readable value
        expect(screen.getByLabelText(/Select Grand Prix/i)).toHaveValue('2023 Singapore Grand Prix - Race');
        // Check that the button text defaults to SIMULATION
        expect(screen.getByRole('button', { name: /START SIMULATION STREAM/i })).toBeInTheDocument();
    });

    it('toggles to LIVE mode and updates the start button', () => {
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        // Find and click the LIVE toggle button
        const liveToggle = screen.getByRole('button', { name: /LIVE FEED/i });
        fireEvent.click(liveToggle);

        // The main action button should now reflect the LIVE state
        expect(screen.getByRole('button', { name: /START LIVE STREAM/i })).toBeInTheDocument();
    });

    it('successfully sends the ingestion command and triggers the callback', async () => {
        // Setup the mock to resolve successfully
        vi.mocked(sendIngestionCommand).mockResolvedValue('Simulation initiated');

        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        // Click Start (using the default selected Singapore Grand Prix which maps to key 9165)
        const startButton = screen.getByRole('button', { name: /START SIMULATION STREAM/i });
        fireEvent.click(startButton);

        // Assert 1: The API was called with the correct payload
        expect(sendIngestionCommand).toHaveBeenCalledWith({
            mode: 'SIMULATION',
            sessionKey: 9165
        });

        // Assert 2: The UI shows the loading state temporarily
        expect(screen.getByRole('button', { name: /INITIALIZING\.\.\./i })).toBeInTheDocument();

        // Assert 3: Wait for the async operation to finish and verify the parent callback was fired
        await waitFor(() => {
            expect(mockOnStreamStarted).toHaveBeenCalledWith(9165, 'SIMULATION');
        });
    });

    it('handles API failures gracefully without triggering the callback', async () => {
        // Setup the mock to reject/fail
        vi.mocked(sendIngestionCommand).mockRejectedValue(new Error('Network Error'));

        // Mock window.alert to prevent it from failing the test environment
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        const startButton = screen.getByRole('button', { name: /START SIMULATION STREAM/i });
        fireEvent.click(startButton);

        await waitFor(() => {
            // Callback should NEVER be called if the API fails
            expect(mockOnStreamStarted).not.toHaveBeenCalled();
            // Alert should have been shown to the user
            expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Failed to connect'));
        });

        alertMock.mockRestore();
    });
});