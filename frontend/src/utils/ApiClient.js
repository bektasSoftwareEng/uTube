import axios from 'axios';

const ApiClient = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for tokens
ApiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling 401s
ApiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized (redirect to login, etc)
            console.error('Unauthorized access - potential token expiration');
            // localStorage.removeItem('access_token');
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default ApiClient;
