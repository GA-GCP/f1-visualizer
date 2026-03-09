import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionControlPanel from '../selectors/SessionControlPanel';
import { sendIngestionCommand } from '@/api/ingestionApi.ts';
import { fetchYears, fetchSessionsByYear, fetchSessionDrivers } from '@/api/referenceApi.ts';

// 1. Mock BOTH API modules
vi.mock('../../api/ingestionApi', () => ({
    sendIngestionCommand: vi.fn()
}));

vi.mock('../../api/referenceApi', () => ({
    fetchYears: vi.fn(),
    fetchSessionsByYear: vi.fn(),
    fetchSessionDrivers: vi.fn(),
}));

describe('SessionControlPanel', () => {
    const mockOnStreamStarted = vi.fn();

    // Mock data
    const mockYears = [2023];
    const mockSessions = [
        { sessionKey: 9165, sessionName: "Race", meetingName: "Singapore Grand Prix", year: 2023, countryName: "Singapore" }
    ];
    const mockRoster = {
        sessionKey: 9165,
        year: 2023,
        drivers: [
            { driverNumber: 1, broadcastName: "M VERSTAPPEN", nameAcronym: "VER", teamName: "Red Bull Racing", teamColour: "3671C6", countryCode: "NED" }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchYears).mockResolvedValue(mockYears);
        vi.mocked(fetchSessionsByYear).mockResolvedValue(mockSessions);
        vi.mocked(fetchSessionDrivers).mockResolvedValue(mockRoster);
    });

    it('renders the control panel with simulation mode', async () => {
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        expect(screen.getByText('RACE INITIALIZATION')).toBeInTheDocument();

        // Wait for the cascading fetch to populate both dropdowns
        await waitFor(() => {
            expect(screen.getByLabelText(/Select Grand Prix/i)).toHaveValue('Singapore Grand Prix - Race');
        });

        expect(screen.getByRole('button', { name: /START SIMULATION/i })).toBeInTheDocument();
    });

    it('successfully sends the ingestion command and triggers the callback', async () => {
        // Setup the mock to resolve successfully
        vi.mocked(sendIngestionCommand).mockResolvedValue('Simulation initiated');

        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} />);

        // Wait for Start button to be enabled (data loaded)
        const startButton = await screen.findByRole('button', { name: /START SIMULATION/i });
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
            expect(mockOnStreamStarted).toHaveBeenCalledWith(9165, 'SIMULATION', mockSessions[0]);
        });
    });

    it('handles API failures gracefully without triggering the callback', async () => {
        // Setup the mock to reject/fail
        vi.mocked(sendIngestionCommand).mockRejectedValue(new Error('Network Error'));

        // 1. Create a mock for the new onError prop instead of window.alert
        const mockOnError = vi.fn();

        // 2. Pass the mock into the component
        render(<SessionControlPanel onStreamStarted={mockOnStreamStarted} onError={mockOnError} />);

        const startButton = await screen.findByRole('button', { name: /START SIMULATION/i });
        await waitFor(() => expect(startButton).toBeEnabled());

        fireEvent.click(startButton);

        await waitFor(() => {
            // Callback should NEVER be called if the API fails
            expect(mockOnStreamStarted).not.toHaveBeenCalled();
            // 3. Assert that our onError callback was triggered with the correct message
            expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('SIMULATION FAILED'));
        });
    });
});
