import { apiClient } from './apiClient';
import type { UserProfile, UserPreferences } from '../types/user';

export const fetchCurrentUser = async (): Promise<UserProfile> => {
    const res = await apiClient.get('/users/me');
    return res.data;
};

export const updateUserPreferences = async (preferences: UserPreferences): Promise<UserProfile> => {
    const res = await apiClient.put('/users/me/preferences', preferences);
    return res.data;
};