import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion } from 'framer-motion';
import motionFeatures from '../motionFeatures';
import { broadcastTheme } from '../theme/theme';

interface Options extends Omit<RenderOptions, 'wrapper'> {
    /** Initial URL, for components that read the router. */
    route?: string;
}

/**
 * A query client per render.
 *
 * Sharing one across tests would leak cached responses between them, which is
 * exactly the kind of order-dependence that makes a suite flaky. Retries are off
 * so a rejected query fails the assertion immediately rather than after backoff.
 */
export function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
    });
}

/** Renders inside the app's real theme, a router and a fresh query client. */
export function renderWithProviders(
    ui: ReactElement,
    { route = '/', ...options }: Options = {},
): RenderResult & { queryClient: QueryClient } {
    const queryClient = createTestQueryClient();

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={broadcastTheme}>
                {/* The same bundle App.tsx loads, imported statically rather than
                    dynamically: features are present on the first render instead
                    of arriving a microtask later, and the suite cannot drift onto
                    a different feature set than production runs.
                    `strict` is kept: a `motion.*` that escaped the codemod fails
                    a test rather than only production. */}
                <LazyMotion features={motionFeatures} strict>
                    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
                </LazyMotion>
            </ThemeProvider>
        </QueryClientProvider>
    );

    return { ...render(ui, { wrapper, ...options }), queryClient };
}
