import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserProvider, useUser } from '../../context/UserContext';
import { useOktaAuth } from '@okta/okta-react';
import { fetchCurrentUser } from '@/api/userApi.ts';

// Mock dependencies
vi.mock('@okta/okta-react', () => ({
    useOktaAuth: vi.fn()
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

    it('fetches user profile if Okta is authenticated', async () => {
        // Arrange
        vi.mocked(useOktaAuth).mockReturnValue({
            authState: { isAuthenticated: true }
        } as any);

        vi.mocked(fetchCurrentUser).mockResolvedValue({
            oktaSubId: '123',
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

    it('does not fetch profile if Okta is unauthenticated', async () => {
        // Arrange
        vi.mocked(useOktaAuth).mockReturnValue({
            authState: { isAuthenticated: false }
        } as any);

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