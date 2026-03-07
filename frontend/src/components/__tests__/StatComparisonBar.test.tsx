import { render, screen } from '@testing-library/react';
import StatComparisonBar from '../versus/StatComparisonBar';

const mockDriverA = {
    id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull Racing", teamColor: "#3671C6",
    stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98, totalPoints: 2586, bestChampionshipFinish: 1, totalRaces: 185, teamsDrivenFor: ['Red Bull Racing'] }
};

const mockDriverB = {
    id: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", teamColor: "#E80020",
    stats: { speed: 96, consistency: 88, aggression: 90, tireMgmt: 85, experience: 80, wins: 5, podiums: 30, totalPoints: 1200, bestChampionshipFinish: 2, totalRaces: 130, teamsDrivenFor: ['Ferrari', 'Sauber'] }
};

describe('StatComparisonBar', () => {
    it('renders correct stats for both drivers', () => {
        render(
            <StatComparisonBar
                label="Wins"
                driverA={mockDriverA}
                driverB={mockDriverB}
                metric="wins"
            />
        );

        // Check for displayed numbers
        expect(screen.getByText(mockDriverA.stats.wins.toString())).toBeInTheDocument();
        expect(screen.getByText(mockDriverB.stats.wins.toString())).toBeInTheDocument();
        expect(screen.getByText(/wins/i)).toBeInTheDocument();
    });
});