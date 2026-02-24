import React, { useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { apiClient } from '../api/apiClient';

export const AxiosAuthInterceptor: React.FC = () => {
    const { authState } = useOktaAuth();

    useEffect(() => {
        const requestInterceptor = apiClient.interceptors.request.use((config) => {
            if (authState?.accessToken?.accessToken) {
                config.headers.Authorization = `Bearer ${authState.accessToken.accessToken}`;
            }
            return config;
        });

        return () => {
            apiClient.interceptors.request.eject(requestInterceptor);
        };
    }, [authState]);

    return null;
};