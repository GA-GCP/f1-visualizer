import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/queryClient';
import { UserProvider } from '../context/UserContext';

/**
 * Server-state and user-profile providers for the authenticated app.
 *
 * Deliberately below the auth guard and loaded lazily: the public landing page
 * has no server state, so putting the query client at the app root would add
 * the library to the chunk every visitor downloads before logging in.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <UserProvider>{children}</UserProvider>
        </QueryClientProvider>
    );
}
