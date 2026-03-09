import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DataVaultLoader from '../DataVaultLoader';

describe('DataVaultLoader', () => {
    it('renders the pulsing title with redacted race name', () => {
        render(<DataVaultLoader />);

        expect(screen.getByText('LAP TIMES // ████████')).toBeInTheDocument();
    });

    it('renders an SVG chart preview area', () => {
        const { container } = render(<DataVaultLoader />);

        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 800 400');
    });

    it('renders axis labels in the SVG', () => {
        render(<DataVaultLoader />);

        expect(screen.getByText('LAP NUMBER')).toBeInTheDocument();
        expect(screen.getByText('LAP DURATION (s)')).toBeInTheDocument();
    });

    it('renders ghost chart lines for each team color', () => {
        const { container } = render(<DataVaultLoader />);

        // 5 ghost path elements (one per GHOST_COLORS entry)
        const paths = container.querySelectorAll('svg path[fill="none"]');
        expect(paths.length).toBeGreaterThanOrEqual(5);
    });

    it('shows the first status message initially', () => {
        render(<DataVaultLoader />);

        expect(screen.getByText('ACCESSING DATA VAULT...')).toBeInTheDocument();
    });

    it('renders the bottom shimmer bar', () => {
        const { container } = render(<DataVaultLoader />);

        // The shimmer bar contains a gradient div
        const shimmerDivs = container.querySelectorAll('div[style*="linear-gradient"]');
        expect(shimmerDivs.length).toBeGreaterThanOrEqual(1);
    });
});
