import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VersusMode from '../../pages/VersusMode';
import { fetchDrivers, fetchDriverStats } from '@/api/referenceApi.ts';

// Mock the reference API
vi.mock('../../api/referenceApi', () => ({
    fetchDrivers: vi.fn(),
    fetchDriverStats: vi.fn()
}));

// Mock the heavy D3 Radar Chart
vi.mock('../../components/versus/RadarChart', () => ({
    default: () => <div data-testid="mock-radar-chart">Radar Chart</div>
}));

describe('VersusMode Page', () => {
    const mockDrivers = [
        {
            id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull", teamColor: "#3671C6",
            stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98, totalPoints: 2586, bestChampionshipFinish: 1, totalRaces: 185, teamsDrivenFor: ['Red Bull Racing'] }
        },
        {
            id: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", teamColor: "#E80020",
            stats: { speed: 96, consistency: 88, aggression: 90, tireMgmt: 85, experience: 80, wins: 5, podiums: 30, totalPoints: 1200, bestChampionshipFinish: 2, totalRaces: 130, teamsDrivenFor: ['Ferrari', 'Sauber'] }
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchDrivers).mockResolvedValue(mockDrivers);

        // FIX: Dynamically return the correct stats based on the driver ID requested
        vi.mocked(fetchDriverStats).mockImplementation(async (id: number) => {
            const driver = mockDrivers.find(d => d.id === id);
            return driver ? driver.stats : mockDrivers[0].stats;
        });
    });

    it('shows loading state initially, then renders comparison engine when data arrives', async () => {
        render(<VersusMode />);

        // Verify the HeadToHeadLoader splash is rendered during loading
        expect(screen.getByText('INITIALIZING VERSUS MODE...')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-radar-chart')).not.toBeInTheDocument();

        // Wait for the data to resolve and the main title to appear
        await waitFor(() => {
            expect(screen.getByText('COMPARISON ENGINE')).toBeInTheDocument();
        });

        // The loader splash should be gone
        expect(screen.queryByText('INITIALIZING VERSUS MODE...')).not.toBeInTheDocument();

        // Verify the mocked Radar Chart is rendered
        expect(screen.getByTestId('mock-radar-chart')).toBeInTheDocument();

        // Verify stat bars rendered (by checking for driver wins)
        // Since the mock is now dynamic, there will only be exactly one "54" and one "5"
        expect(screen.getByText('54')).toBeInTheDocument(); // VER wins
        expect(screen.getByText('5')).toBeInTheDocument();  // LEC wins
    });
});