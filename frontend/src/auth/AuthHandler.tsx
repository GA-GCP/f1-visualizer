import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { apiClient } from '../api/apiClient';

export const AxiosAuthInterceptor: React.FC = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();

    useEffect(() => {
        const requestInterceptor = apiClient.interceptors.request.use(async (config) => {
            if (isAuthenticated) {
                try {
                    // This dynamically fetches/refreshes the Auth0 JWT token
                    const token = await getAccessTokenSilently();
                    config.headers.Authorization = `Bearer ${token}`;
                } catch (error) {
                    console.error("Failed to acquire Auth0 access token", error);
                }
            }
            return config;
        });

        return () => {
            apiClient.interceptors.request.eject(requestInterceptor);
        };
    }, [isAuthenticated, getAccessTokenSilently]);

    return null;
};