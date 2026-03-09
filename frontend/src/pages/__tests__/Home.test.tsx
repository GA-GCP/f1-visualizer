import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from '../Home';

// Mock the RaceSimulator component to isolate the Home page test
vi.mock('../../components/RaceSimulator', () => ({
    default: () => <div data-testid="race-simulator">RaceSimulator</div>,
}));

describe('Home', () => {
    it('renders the RaceSimulator component', () => {
        render(<Home />);

        expect(screen.getByTestId('race-simulator')).toBeInTheDocument();
    });
});
