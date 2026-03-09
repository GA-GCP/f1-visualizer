import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the module under test
vi.mock('../apiClient', () => ({
    apiClient: {
        get: vi.fn(),
        put: vi.fn(),
    },
}));

import { apiClient } from '../apiClient';
import { fetchCurrentUser, updateUserPreferences } from '../userApi';
import type { UserProfile, UserPreferences } from '../../types/user';

describe('userApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchCurrentUser', () => {
        it('fetches the current user profile', async () => {
            const mockUser: UserProfile = {
                authSubId: 'auth0|123',
                email: 'leclerc@ferrari.com',
                createdAt: '2024-01-01T00:00:00Z',
                preferences: { favoriteDriver: 'Charles Leclerc', team: 'Ferrari' },
            };
            vi.mocked(apiClient.get).mockResolvedValue({ data: mockUser });

            const result = await fetchCurrentUser();

            expect(apiClient.get).toHaveBeenCalledWith('/users/me');
            expect(result).toEqual(mockUser);
        });
    });

    describe('updateUserPreferences', () => {
        it('sends preferences and returns updated profile', async () => {
            const preferences: UserPreferences = {
                favoriteDriver: 'Max Verstappen',
                team: 'Red Bull',
            };
            const updatedUser: UserProfile = {
                authSubId: 'auth0|123',
                email: 'user@test.com',
                createdAt: '2024-01-01T00:00:00Z',
                preferences,
            };
            vi.mocked(apiClient.put).mockResolvedValue({ data: updatedUser });

            const result = await updateUserPreferences(preferences);

            expect(apiClient.put).toHaveBeenCalledWith('/users/me/preferences', preferences);
            expect(result).toEqual(updatedUser);
        });
    });
});
