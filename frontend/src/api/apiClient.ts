import axios from 'axios';

// 1. Dynamically determine the base URL based on the Vite build mode
let targetBaseUrl = '/api/v1'; // Default for local 'development' (uses Vite proxy)

if (import.meta.env.MODE === 'prod') {
    targetBaseUrl = 'https://api.f1visualizer.com/api/v1';
} else if (import.meta.env.MODE === 'uat') {
    targetBaseUrl = 'https://uat.api.f1visualizer.com/api/v1';
} else if (import.meta.env.MODE === 'dev') {
    targetBaseUrl = 'https://dev.api.f1visualizer.com/api/v1';
}

export const apiClient = axios.create({
    baseURL: targetBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('[API] Unauthorized. User session may have expired.');
        }
        return Promise.reject(error);
    }
);