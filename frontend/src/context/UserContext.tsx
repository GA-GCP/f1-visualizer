import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchCurrentUser, updateUserPreferences } from '../api/userApi';
import { createLogger } from '../lib/logger';
import type { UserProfile, UserPreferences } from '../types/user';

const log = createLogger('user');

interface UserContextType {
    userProfile: UserProfile | null;
    updatePreferences: (prefs: UserPreferences) => Promise<void>;
    isLoading: boolean;
    error: 'service_unavailable' | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth0();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<'service_unavailable' | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        const loadUser = async () => {
            if (isAuthenticated) {
                try {
                    const profile = await fetchCurrentUser(controller.signal);
                    if (isMounted) {
                        setUserProfile(profile);
                        setError(null);
                    }
                } catch (err: unknown) {
                    if (axios.isAxiosError(err)) {
                        const status = err.response?.status;
                        if (status === 404) {
                            log.warn(
                                '[UserContext] User Service returned 404. ' +
                                    'The service may not be running or the user may not exist yet.',
                            );
                        } else if (status === 400) {
                            log.error(
                                '[UserContext] User Service returned 400. ' +
                                    "JWT may be missing the 'email' claim. " +
                                    'Ensure the Auth0 Post-Login Action enriches the access token.',
                                err.response?.data,
                            );
                        } else {
                            log.error(
                                '[UserContext] Failed to load user profile:',
                                status,
                                err.response?.data,
                            );
                        }
                    } else {
                        log.error('[UserContext] Failed to load user profile:', err);
                    }
                    if (isMounted) setError('service_unavailable');
                }
            } else {
                if (isMounted) {
                    setUserProfile(null);
                    setError(null);
                }
            }
            if (isMounted) setIsLoading(false);
        };

        void loadUser();
        return () => {
            isMounted = false;
        };
    }, [isAuthenticated]);

    const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
        try {
            const updatedProfile = await updateUserPreferences(newPrefs);
            setUserProfile(updatedProfile);
        } catch (err) {
            log.error('Failed to update user preferences', err);
            // Rethrow. Swallowing this made the settings modal's own failure
            // alert unreachable: the dialog closed as though the save had
            // succeeded, and the preference silently did not persist.
            throw err;
        }
    };

    return (
        <UserContext.Provider
            value={{ userProfile, updatePreferences: handleUpdatePreferences, isLoading, error }}
        >
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
