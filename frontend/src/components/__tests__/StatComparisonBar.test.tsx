import { render, screen } from '@testing-library/react';
import StatComparisonBar from '../versus/StatComparisonBar';
import { MOCK_DRIVERS } from '@/data/mockDrivers.ts';

describe('StatComparisonBar', () => {
    const driverA = MOCK_DRIVERS[0]; // VER
    const driverB = MOCK_DRIVERS[1]; // LEC

    it('renders correct stats for both drivers', () => {
        render(
            <StatComparisonBar
                label="Wins"
                driverA={driverA}
                driverB={driverB}
                metric="wins"
            />
        );

        // Check for displayed numbers
        expect(screen.getByText(driverA.stats.wins.toString())).toBeInTheDocument();
        expect(screen.getByText(driverB.stats.wins.toString())).toBeInTheDocument();
        expect(screen.getByText(/wins/i)).toBeInTheDocument();
    });
});