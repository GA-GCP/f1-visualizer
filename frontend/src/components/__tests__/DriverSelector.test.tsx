import { render, screen } from '@testing-library/react';
import DriverSelector from '../selectors/DriverSelector';
import { vi } from 'vitest';

const mockDrivers = [
    {
        id: 1, code: "VER", name: "Max Verstappen", team: "Red Bull Racing", teamColor: "#3671C6",
        stats: { speed: 99, consistency: 95, aggression: 98, tireMgmt: 92, experience: 85, wins: 54, podiums: 98 }
    }
];

describe('DriverSelector', () => {
    it('renders the label correctly', () => {
        render(
            <DriverSelector
                label="Select Driver"
                options={mockDrivers}
                value={null}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByLabelText(/select driver/i)).toBeInTheDocument();
    });

    it('displays the selected driver value', () => {
        render(
            <DriverSelector
                label="Select Driver"
                options={mockDrivers}
                value={mockDrivers[0]}
                onChange={vi.fn()}
            />
        );
        // Autocomplete input value should match the format in getOptionLabel
        expect(screen.getByDisplayValue('VER - Max Verstappen')).toBeInTheDocument();
    });
});