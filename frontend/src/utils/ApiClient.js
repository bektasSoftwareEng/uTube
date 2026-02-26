import axios from 'axios';
import { UTUBE_TOKEN, UTUBE_USER } from './authConstants';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const ApiClient = axios.create({
    baseURL: `${API_BASE}/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for tokens
ApiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem(UTUBE_TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling 401s and 429s
ApiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401) {
            // Secure Handling: Immediately clear token to prevent session hijacking
            console.error('Unauthorized access - potential token expiration or hijacking attempt');
            localStorage.removeItem(UTUBE_TOKEN);
            localStorage.removeItem(UTUBE_USER);
            // Force a reload or redirect to login to ensure clean state
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        if (status === 429) {
            // Brute-force protection: Notify the user of rate limiting
            alert('Too many attempts. Please wait a moment before trying again.');
        }

        return Promise.reject(error);
    }
);


export default ApiClient;
