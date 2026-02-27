import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { fetchCurrentUser, updateUserPreferences } from '../api/userApi';
import type { UserProfile, UserPreferences } from '../types/user';

interface UserContextType {
    userProfile: UserProfile | null;
    updatePreferences: (prefs: UserPreferences) => Promise<void>;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { authState } = useOktaAuth();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadUser = async () => {
            if (authState?.isAuthenticated) {
                try {
                    const profile = await fetchCurrentUser();
                    if (isMounted) setUserProfile(profile);
                } catch (err) {
                    console.error("Failed to load user profile. Is the User Service running?", err);
                }
            } else {
                if (isMounted) setUserProfile(null);
            }
            if (isMounted) setIsLoading(false);
        };

        void loadUser();
        return () => { isMounted = false; };
    }, [authState?.isAuthenticated]);

    const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
        const updatedProfile = await updateUserPreferences(newPrefs);
        setUserProfile(updatedProfile);
    };

    return (
        <UserContext.Provider value={{ userProfile, updatePreferences: handleUpdatePreferences, isLoading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};