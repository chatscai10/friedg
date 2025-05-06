import axios from 'axios';
import { authService } from './authService'; // Import authService to get the token

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create a new Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await authService.getAuthToken(); // Get the current user's ID token (force refresh defaults to false)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Auth token added to request header.'); // Log for debugging
    } else {
      console.log('No auth token available for request.'); // Log if no token found
    }
    return config;
  },
  (error) => {
    // Handle request error here
    console.error('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Optional: Add a response interceptor for handling common errors (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    if (error.response && error.response.status === 401) {
      // Handle 401 Unauthorized - e.g., redirect to login, refresh token, etc.
      console.error('API request Unauthorized (401). Token might be invalid or expired.');
      // Example: Trigger logout or redirect
      // Consider calling a function that handles session expiry more gracefully
      // For now, just log the error. Proper handling might involve redirecting.
      // authService.logout();
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient; 