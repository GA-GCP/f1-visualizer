import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeadToHeadLoader from '../HeadToHeadLoader';

describe('HeadToHeadLoader', () => {
    it('renders the HEAD-TO-HEAD title and subtitle', () => {
        render(<HeadToHeadLoader />);

        expect(screen.getByText('HEAD-TO-HEAD')).toBeInTheDocument();
        expect(screen.getByText('COMPARISON ENGINE')).toBeInTheDocument();
    });

    it('renders the ghost radar chart with axis labels', () => {
        render(<HeadToHeadLoader />);

        expect(screen.getByText('ATTRIBUTE MAPPING')).toBeInTheDocument();
        expect(screen.getByText('SPEED')).toBeInTheDocument();
        expect(screen.getByText('CONSISTENCY')).toBeInTheDocument();
        expect(screen.getByText('AGGRESSION')).toBeInTheDocument();
        expect(screen.getByText('TIRE MGMT')).toBeInTheDocument();
        expect(screen.getByText('EXPERIENCE')).toBeInTheDocument();
    });

    it('renders the ghost career statistics section with stat labels', () => {
        render(<HeadToHeadLoader />);

        expect(screen.getByText('CAREER STATISTICS')).toBeInTheDocument();
        expect(screen.getByText('RACE WINS')).toBeInTheDocument();
        expect(screen.getByText('PODIUM FINISHES')).toBeInTheDocument();
        expect(screen.getByText('TOTAL CAREER POINTS')).toBeInTheDocument();
        expect(screen.getByText('TOTAL RACES')).toBeInTheDocument();
        expect(screen.getByText('BEST CHAMPIONSHIP FINISH')).toBeInTheDocument();
    });

    it('renders the "vs" label between ghost driver placeholders', () => {
        render(<HeadToHeadLoader />);

        expect(screen.getByText('vs')).toBeInTheDocument();
    });

    it('shows the first status message initially', () => {
        render(<HeadToHeadLoader />);

        expect(screen.getByText('INITIALIZING VERSUS MODE...')).toBeInTheDocument();
    });

    it('renders ghost stat bars for all five metrics', () => {
        render(<HeadToHeadLoader />);

        // 5 stat bars means 5 stat label rows
        const statLabels = ['RACE WINS', 'PODIUM FINISHES', 'TOTAL CAREER POINTS', 'TOTAL RACES', 'BEST CHAMPIONSHIP FINISH'];
        statLabels.forEach(label => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });
});
