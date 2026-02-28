import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserProvider, useUser } from '../../context/UserContext';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchCurrentUser } from '@/api/userApi.ts';

// Mock dependencies
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: vi.fn()
}));

vi.mock('../../api/userApi', () => ({
    fetchCurrentUser: vi.fn()
}));

const DummyConsumer = () => {
    const { userProfile, isLoading } = useUser();
    if (isLoading) return <div>Loading...</div>;
    return <div>{userProfile ? `Driver: ${userProfile.preferences.favoriteDriver}` : 'No User'}</div>;
};

describe('UserContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches user profile if Auth0 is authenticated', async () => {
        // Arrange: Use double assertion to bypass "any" rule safely
        vi.mocked(useAuth0).mockReturnValue({
            isAuthenticated: true
        } as unknown as ReturnType<typeof useAuth0>);

        vi.mocked(fetchCurrentUser).mockResolvedValue({
            authSubId: '123',
            email: 'test@f1.com',
            createdAt: '2024-01-01',
            preferences: { favoriteDriver: 'LEC' }
        });

        // Act
        render(
            <UserProvider>
                <DummyConsumer />
            </UserProvider>
        );

        // Assert
        expect(screen.getByText('Loading...')).toBeInTheDocument();

        await waitFor(() => {
            expect(fetchCurrentUser).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Driver: LEC')).toBeInTheDocument();
        });
    });

    it('does not fetch profile if Auth0 is unauthenticated', async () => {
        // Arrange: Use double assertion to bypass "any" rule safely
        vi.mocked(useAuth0).mockReturnValue({
            isAuthenticated: false
        } as unknown as ReturnType<typeof useAuth0>);

        // Act
        render(
            <UserProvider>
                <DummyConsumer />
            </UserProvider>
        );

        // Assert
        await waitFor(() => {
            expect(fetchCurrentUser).not.toHaveBeenCalled();
            expect(screen.getByText('No User')).toBeInTheDocument();
        });
    });
});