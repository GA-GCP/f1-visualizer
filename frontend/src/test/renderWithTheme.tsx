import type { ReactElement } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { broadcastTheme } from '../theme/theme';

interface Options extends Omit<RenderOptions, 'wrapper'> {
    /** Initial URL, for components that read the router. */
    route?: string;
}

/**
 * Renders inside the app's real theme and a router.
 *
 * Accessibility assertions are only meaningful against the actual palette and
 * typography — contrast and focus styles come from the theme, so rendering with
 * MUI's default would test something the app never shows.
 */
export function renderWithTheme(ui: ReactElement, { route = '/', ...options }: Options = {}): RenderResult {
    return render(ui, {
        wrapper: ({ children }) => (
            <ThemeProvider theme={broadcastTheme}>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </ThemeProvider>
        ),
        ...options,
    });
}
