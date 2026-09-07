import { apiClient } from './apiClient';
import { userProfileSchema, type UserPreferences, type UserProfile } from './schemas';
import { parseResponse } from './parseResponse';

export const fetchCurrentUser = async (signal?: AbortSignal): Promise<UserProfile> => {
    const res = await apiClient.get('/users/me', { signal });
    return parseResponse(userProfileSchema, res.data, 'GET /users/me');
};

export const updateUserPreferences = async (preferences: UserPreferences): Promise<UserProfile> => {
    const res = await apiClient.put('/users/me/preferences', preferences);
    return parseResponse(userProfileSchema, res.data, 'PUT /users/me/preferences');
};