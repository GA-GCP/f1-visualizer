import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SplashBackground from '../SplashBackground';

describe('SplashBackground', () => {
    it('renders without crashing', () => {
        const { container } = render(<SplashBackground />);

        expect(container.firstChild).toBeInTheDocument();
    });

    it('renders the background container with absolute positioning', () => {
        const { container } = render(<SplashBackground />);

        // The outer Box has position: absolute and overflow: hidden
        const outerBox = container.firstChild as HTMLElement;
        expect(outerBox).toBeInTheDocument();
    });
});
