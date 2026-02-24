import { render, screen, fireEvent } from '@testing-library/react';
import DriverSelector from '../selectors/DriverSelector';
import { MOCK_DRIVERS } from '@/data/mockDrivers.ts';
import { vi } from 'vitest';

describe('DriverSelector', () => {
    it('renders the label correctly', () => {
        render(
            <DriverSelector
                label="Select Driver"
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
                value={MOCK_DRIVERS[0]} // Verstappen
                onChange={vi.fn()}
            />
        );
        // Autocomplete input value should match the format in getOptionLabel
        expect(screen.getByDisplayValue('VER - Max Verstappen')).toBeInTheDocument();
    });
});