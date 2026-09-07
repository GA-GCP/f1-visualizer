import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HistoricalData from '../../pages/HistoricalData';
import { fetchSessions, fetchSessionDrivers, fetchSessionLaps } from '@/api/referenceApi.ts';

// Mock the reference API
vi.mock('../../api/referenceApi', () => ({
    fetchSessions: vi.fn(),
    fetchSessionDrivers: vi.fn(),
    fetchSessionLaps: vi.fn()
}));

// Mock the D3 Chart to avoid SVG rendering issues in JSDOM
vi.mock('../../components/LapTimeChart', () => ({
    default: () => <div data-testid="mock-lap-chart">Mock Lap Chart</div>
}));

/** The page stores its selection in the URL, so it needs router context. */
const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <HistoricalData />
        </MemoryRouter>,
    );

describe('HistoricalData Page', () => {
    const mockSessions = [
        { sessionKey: 9165, sessionName: "Race", meetingName: "Singapore Grand Prix", year: 2023, countryName: "Singapore" },
        { sessionKey: 9222, sessionName: "Race", meetingName: "Suzuka Grand Prix", year: 2023, countryName: "Japan" },
    ];

    const mockRoster = {
        sessionKey: 9165,
        year: 2023,
        drivers: [
            { driverNumber: 44, broadcastName: 'L HAMILTON', nameAcronym: 'HAM', teamName: 'Mercedes', teamColour: '00D2BE', countryCode: 'GBR' },
            { driverNumber: 63, broadcastName: 'G RUSSELL', nameAcronym: 'RUS', teamName: 'Mercedes', teamColour: '00D2BE', countryCode: 'GBR' },
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchSessions).mockResolvedValue(mockSessions);
        vi.mocked(fetchSessionDrivers).mockResolvedValue(mockRoster);
        vi.mocked(fetchSessionLaps).mockResolvedValue([]);
    });

    it('fetches sessions on mount and requests lap data for the default session', async () => {
        renderAt('/');

        expect(screen.getByText('Historical Analysis Engine')).toBeInTheDocument();

        // Verify it fetches the master session list
        await waitFor(() => {
            expect(fetchSessions).toHaveBeenCalledTimes(1);
        });

        // Verify that once the session list is fetched, it uses the first sessionKey to fetch laps and drivers
        await waitFor(() => {
            expect(fetchSessionLaps).toHaveBeenCalledWith(9165);
        });

        await waitFor(() => {
            expect(fetchSessionDrivers).toHaveBeenCalledWith(9165);
        });

        // Ensure the chart renders after loading completes
        await waitFor(() => {
            expect(screen.getByTestId('mock-lap-chart')).toBeInTheDocument();
        });
    });

    it('honours a session chosen in the URL instead of defaulting to the first', async () => {
        // The page unmounts when the user visits another tab, so the selection
        // has to live somewhere that survives it — and that back/forward can
        // restore.
        renderAt('/?session=9222');

        await waitFor(() => {
            expect(fetchSessionLaps).toHaveBeenCalledWith(9222);
        });
        expect(fetchSessionLaps).not.toHaveBeenCalledWith(9165);
    });
});
