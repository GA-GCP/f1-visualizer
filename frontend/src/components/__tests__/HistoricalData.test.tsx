import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HistoricalData from '../../pages/HistoricalData';
import { fetchSessions } from '@/api/referenceApi.ts';
import { apiClient } from '@/api/apiClient.ts';

// Mock the reference API
vi.mock('../../api/referenceApi', () => ({
    fetchSessions: vi.fn()
}));

// Mock the base Axios client used for lap data
vi.mock('../../api/apiClient', () => ({
    apiClient: {
        get: vi.fn()
    }
}));

// Mock the D3 Chart to avoid SVG rendering issues in JSDOM
vi.mock('../../components/LapTimeChart', () => ({
    default: () => <div data-testid="mock-lap-chart">Mock Lap Chart</div>
}));

describe('HistoricalData Page', () => {
    const mockSessions = [
        { sessionKey: 9165, sessionName: "Race", meetingName: "Singapore Grand Prix", year: 2023, countryName: "Singapore" }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchSessions).mockResolvedValue(mockSessions);
        vi.mocked(apiClient.get).mockResolvedValue({ data: [] }); // Return empty laps for test
    });

    it('fetches sessions on mount and requests lap data for the default session', async () => {
        render(<HistoricalData />);

        expect(screen.getByText('Historical Analysis Engine')).toBeInTheDocument();

        // Verify it fetches the master session list
        await waitFor(() => {
            expect(fetchSessions).toHaveBeenCalledTimes(1);
        });

        // Verify that once the session list is fetched, it uses the first sessionKey to fetch laps
        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith('/analysis/session/9165/laps');
        });

        // Ensure the chart renders
        expect(screen.getByTestId('mock-lap-chart')).toBeInTheDocument();
    });
});