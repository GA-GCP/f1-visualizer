import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchCurrentUser, updateUserPreferences } from '../api/userApi';
import type { UserProfile, UserPreferences } from '../types/user';

interface UserContextType {
    userProfile: UserProfile | null;
    updatePreferences: (prefs: UserPreferences) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth0();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadUser = async () => {
            if (isAuthenticated) {
                try {
                    const profile = await fetchCurrentUser();
                    if (isMounted) setUserProfile(profile);
                } catch (err) {
                    console.error("Failed to load user profile. Is the User Service running?", err);
                    if (isMounted) setError(err instanceof Error ? err.message : String(err));
                }
            } else {
                if (isMounted) setUserProfile(null);
            }
            if (isMounted) setIsLoading(false);
        };

        void loadUser();
        return () => { isMounted = false; };
    }, [isAuthenticated]);

    const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
        const updatedProfile = await updateUserPreferences(newPrefs);
        setUserProfile(updatedProfile);
    };

    return (
        <UserContext.Provider value={{ userProfile, updatePreferences: handleUpdatePreferences, isLoading, error }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};