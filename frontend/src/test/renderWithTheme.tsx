import { renderWithProviders } from './renderWithProviders';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

interface Options extends Omit<RenderOptions, 'wrapper'> {
    route?: string;
}

/**
 * Renders inside the app's real theme, router and query client.
 *
 * Accessibility assertions are only meaningful against the actual palette and
 * typography — contrast and focus styles come from the theme, so rendering with
 * MUI's default would test something the app never shows.
 */
export function renderWithTheme(ui: ReactElement, options: Options = {}): RenderResult {
    return renderWithProviders(ui, options);
}
