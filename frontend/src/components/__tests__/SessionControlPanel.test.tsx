import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionControlPanel from '../selectors/SessionControlPanel';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { searchSessions } from '@/api/referenceApi.ts';

// 1. Mock BOTH API modules
vi.mock('../../api/ingestionApi', () => ({
    sendIngestionCommand: vi.fn()
}));

vi.mock('../../api/referenceApi', () => ({
    searchSessions: vi.fn() // <-- UPDATED MOCK
}));

describe('SessionControlPanel', () => {
    const mockOnStreamStarted = vi.fn();

    // Mock response from the backend
    const mockSessions = [
        { sessionKey: 9165, sessionName: "Race", meetingName: "Singapore Grand Prix", year: 2023, countryName: "Singapore" }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(searchSessions).mockResolvedValue(mockSessions); // <-- UPDATED MOCK INJECTION
    });

    it('renders the control panel with default SIMULATION mode', async () => {
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        expect(screen.getByText('RACE INITIALIZATION')).toBeInTheDocument();

        // Wait for the async fetch (and the 300ms debounce) to populate the Autocomplete
        await waitFor(() => {
            // <-- UPDATED LABEL TEXT -->
            expect(screen.getByLabelText(/Search Grand Prix/i)).toHaveValue('2023 Singapore Grand Prix - Race');
        });

        expect(screen.getByRole('button', { name: /START SIMULATION STREAM/i })).toBeInTheDocument();
    });

    it('toggles to LIVE mode and updates the start button', async () => {
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        // Wait for data to load so the component is fully ready
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /START SIMULATION STREAM/i })).toBeEnabled();
        });

        // Find and click the LIVE toggle button
        const liveToggle = screen.getByRole('button', { name: /LIVE FEED/i });
        fireEvent.click(liveToggle);

        expect(screen.getByRole('button', { name: /START LIVE STREAM/i })).toBeInTheDocument();
    });

    it('successfully sends the ingestion command and triggers the callback', async () => {
        // Setup the mock to resolve successfully
        vi.mocked(sendIngestionCommand).mockResolvedValue('Simulation initiated');

        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        // Wait for Start button to be enabled (data loaded)
        const startButton = await screen.findByRole('button', { name: /START SIMULATION STREAM/i });
        await waitFor(() => expect(startButton).toBeEnabled());

        fireEvent.click(startButton);

        // Assert 1: The API was called with the correct payload (using camelCase sessionKey)
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

        const startButton = await screen.findByRole('button', { name: /START SIMULATION STREAM/i });
        await waitFor(() => expect(startButton).toBeEnabled());

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